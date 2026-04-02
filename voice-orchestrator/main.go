// Voice Orchestrator – entry point
// Manages WebSocket connections for real-time voice agent sessions.
// Each call gets its own goroutine-based session with a state machine.
package main

import (
	"context"
	"crypto/subtle"
	"database/sql"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"regexp"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	_ "github.com/lib/pq"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"go.uber.org/zap"

	"github.com/marioretrejo/nextjs-commerce/voice-orchestrator/audio"
	"github.com/marioretrejo/nextjs-commerce/voice-orchestrator/integrations"
	"github.com/marioretrejo/nextjs-commerce/voice-orchestrator/orchestrator"
)

var uuidRE = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  4096,
	WriteBufferSize: 4096,
	CheckOrigin: func(r *http.Request) bool {
		apiKey := r.Header.Get("X-API-Key")
		return validateAPIKey(apiKey)
	},
}

func main() {
	logger, err := zap.NewProduction()
	if err != nil {
		panic("failed to init logger: " + err.Error())
	}
	defer func() {
		// Best-effort sync; log sync errors to stderr
		if err := logger.Sync(); err != nil {
			fmt.Fprintf(os.Stderr, "logger sync error: %v\n", err)
		}
	}()

	db, err := sql.Open("postgres", mustEnv("DATABASE_URL"))
	if err != nil {
		logger.Fatal("failed to open DB", zap.Error(err))
	}
	// Verify connectivity at startup
	if err := db.Ping(); err != nil {
		logger.Fatal("DB unreachable at startup", zap.Error(err))
	}
	defer db.Close()

	// Dependency wiring
	stt := integrations.NewDeepgramSTT(mustEnv("DEEPGRAM_API_KEY"), logger)
	llm := integrations.NewOpenAILLM(mustEnv("OPENAI_API_KEY"), logger)
	tts := integrations.NewElevenLabsTTS(mustEnv("ELEVENLABS_API_KEY"), mustEnv("ELEVENLABS_VOICE_ID"), logger)
	pinecone := integrations.NewPineconeClient(mustEnv("PINECONE_API_KEY"), mustEnv("PINECONE_INDEX_HOST"), logger)
	webhookDispatcher := integrations.NewWebhookDispatcher(logger)

	factory := orchestrator.NewSessionFactory(db, stt, llm, tts, pinecone, webhookDispatcher, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/call", func(w http.ResponseWriter, r *http.Request) {
		handleCallWS(w, r, factory, logger)
	})
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		// Also verify DB is reachable so K8s readiness probe gets accurate signal
		if err := db.PingContext(r.Context()); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			fmt.Fprint(w, "db_unavailable")
			return
		}
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, "ok")
	})
	mux.Handle("/metrics", promhttp.Handler())

	srv := &http.Server{
		Addr:        fmt.Sprintf(":%s", getEnvOrDefault("PORT", "8080")),
		Handler:     mux,
		ReadTimeout: 15 * time.Second, // generous for WS upgrade handshake
		WriteTimeout: 15 * time.Second,
		IdleTimeout: 5 * time.Minute,  // close idle keep-alive connections
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		logger.Info("voice orchestrator listening", zap.String("addr", srv.Addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("server error", zap.Error(err))
		}
	}()

	<-ctx.Done()
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", zap.Error(err))
	}
	logger.Info("server stopped cleanly")
}

func handleCallWS(w http.ResponseWriter, r *http.Request, factory *orchestrator.SessionFactory, logger *zap.Logger) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		logger.Error("websocket upgrade failed", zap.Error(err))
		return
	}

	callID := r.URL.Query().Get("call_id")
	agentID := r.URL.Query().Get("agent_id")

	// Validate UUID format to prevent injection and invalid DB queries
	if !uuidRE.MatchString(callID) || !uuidRE.MatchString(agentID) {
		logger.Warn("invalid call_id or agent_id format", zap.String("call_id", callID), zap.String("agent_id", agentID))
		conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.ClosePolicyViolation, "invalid params"))
		conn.Close()
		return
	}

	session, err := factory.NewSession(r.Context(), callID, agentID)
	if err != nil {
		logger.Error("session creation failed", zap.String("call_id", callID), zap.Error(err))
		conn.Close()
		return
	}

	// Run the session; blocks until call ends or connection drops
	session.Run(r.Context(), conn, audio.NewBuffer(20*time.Millisecond))
}

// validateAPIKey uses constant-time comparison to prevent timing attacks.
func validateAPIKey(key string) bool {
	if key == "" {
		return false
	}
	validKey := os.Getenv("ORCHESTRATOR_API_KEY")
	if validKey == "" {
		return false
	}
	// subtle.ConstantTimeCompare returns 1 only if slices are equal length AND content
	return subtle.ConstantTimeCompare([]byte(key), []byte(validKey)) == 1
}

func mustEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic(fmt.Sprintf("required environment variable %s is not set", key))
	}
	return v
}

func getEnvOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
