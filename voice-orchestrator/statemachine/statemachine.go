// Package statemachine implements the core LISTENING → THINKING → SPEAKING
// state machine for a voice agent session.
//
// Transitions are:
//   LISTENING  → THINKING   : EndOfUtterance detected by VAD/STT
//   THINKING   → SPEAKING   : LLM response fully received (or first token for streaming)
//   SPEAKING   → LISTENING  : TTS playback complete
//   SPEAKING   → THINKING   : Barge-in detected (user interrupts AI)
//   LISTENING  → LISTENING  : Silence timeout (no utterance started)
//
// All transitions are synchronous within a single goroutine (the session loop);
// callbacks are invoked inline so callers must not block.
package statemachine

import (
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"
)

// State represents a named call state.
type State string

const (
	StateListening State = "LISTENING"
	StateThinking  State = "THINKING"
	StateSpeaking  State = "SPEAKING"
)

// Event drives state transitions.
type Event string

const (
	EventEndOfUtterance Event = "END_OF_UTTERANCE"
	EventLLMReady       Event = "LLM_READY"
	EventTTSDone        Event = "TTS_DONE"
	EventBargeIn        Event = "BARGE_IN"
)

// TransitionFunc is called synchronously after every valid transition.
type TransitionFunc func(from, to State, event Event)

// Machine is a thread-safe finite state machine.
type Machine struct {
	mu          sync.RWMutex
	current     State
	transitions map[State]map[Event]State
	callbacks   []TransitionFunc
	history     []Transition
	logger      *zap.Logger
}

// Transition records a state change for audit/analytics.
type Transition struct {
	From      State
	To        State
	Event     Event
	Timestamp time.Time
}

// New constructs a Machine starting in LISTENING state.
func New(logger *zap.Logger, callbacks ...TransitionFunc) *Machine {
	m := &Machine{
		current: StateListening,
		logger:  logger,
		callbacks: callbacks,
		transitions: map[State]map[Event]State{
			StateListening: {
				EventEndOfUtterance: StateThinking,
			},
			StateThinking: {
				EventLLMReady: StateSpeaking,
				EventBargeIn:  StateListening, // user speaks while AI is computing
			},
			StateSpeaking: {
				EventTTSDone: StateListening,
				EventBargeIn: StateThinking,
			},
		},
	}
	return m
}

// Current returns the current state without locking for reads.
func (m *Machine) Current() State {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

// Send triggers an event and performs the transition if valid.
// Returns an error if the event is not allowed in the current state.
func (m *Machine) Send(event Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	allowed, ok := m.transitions[m.current]
	if !ok {
		return fmt.Errorf("no transitions defined from state %s", m.current)
	}
	next, ok := allowed[event]
	if !ok {
		return fmt.Errorf("event %s not allowed in state %s", event, m.current)
	}

	from := m.current
	m.current = next
	t := Transition{From: from, To: next, Event: event, Timestamp: time.Now()}
	m.history = append(m.history, t)

	m.logger.Debug("state transition",
		zap.String("from", string(from)),
		zap.String("to", string(next)),
		zap.String("event", string(event)),
	)

	for _, cb := range m.callbacks {
		cb(from, next, event)
	}
	return nil
}

// Is returns true if the machine is currently in the given state.
func (m *Machine) Is(s State) bool {
	return m.Current() == s
}

// History returns a copy of all recorded transitions.
func (m *Machine) History() []Transition {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]Transition, len(m.history))
	copy(out, m.history)
	return out
}
