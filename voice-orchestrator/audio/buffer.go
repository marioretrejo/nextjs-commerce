// Package audio provides a thread-safe ring buffer for real-time PCM audio chunks.
// Chunks are fixed at the configured frame duration (default 20 ms at 16 kHz = 320 bytes).
package audio

import (
	"sync"
	"time"
)

const (
	SampleRate    = 16000 // Hz
	BitDepth      = 16    // bits
	Channels      = 1     // mono
	BytesPerFrame = SampleRate * (BitDepth / 8) * Channels / 1000 // per ms
)

// Chunk is a single audio frame with its capture timestamp.
type Chunk struct {
	PCM       []byte
	CapturedAt time.Time
}

// Buffer is a thread-safe, bounded FIFO queue of audio chunks.
// Overflow (back-pressure) drops the oldest frame to keep latency stable.
type Buffer struct {
	mu          sync.Mutex
	chunks      []Chunk
	cap         int
	frameDur    time.Duration
	flushSignal chan struct{}
}

// NewBuffer creates a buffer sized to hold ~500 ms of audio by default.
func NewBuffer(frameDur time.Duration) *Buffer {
	maxFrames := int(500*time.Millisecond/frameDur) + 1
	return &Buffer{
		chunks:      make([]Chunk, 0, maxFrames),
		cap:         maxFrames,
		frameDur:    frameDur,
		flushSignal: make(chan struct{}, 1),
	}
}

// Push appends a raw PCM chunk to the buffer.
// If the buffer is full the oldest chunk is evicted (oldest-first eviction).
func (b *Buffer) Push(pcm []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.chunks) >= b.cap {
		// Evict oldest to maintain real-time latency target
		b.chunks = b.chunks[1:]
	}
	b.chunks = append(b.chunks, Chunk{
		PCM:        append([]byte(nil), pcm...),
		CapturedAt: time.Now(),
	})
}

// Pop removes and returns the oldest chunk. Returns false when empty.
func (b *Buffer) Pop() (Chunk, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if len(b.chunks) == 0 {
		return Chunk{}, false
	}
	c := b.chunks[0]
	b.chunks = b.chunks[1:]
	return c, true
}

// Flush atomically empties the buffer and signals any waiters.
// Called on barge-in detection to immediately stop TTS playback.
func (b *Buffer) Flush() {
	b.mu.Lock()
	b.chunks = b.chunks[:0]
	b.mu.Unlock()

	// Non-blocking send: if already signalled, skip duplicate
	select {
	case b.flushSignal <- struct{}{}:
	default:
	}
}

// FlushSignal returns the channel that fires on every Flush() call.
func (b *Buffer) FlushSignal() <-chan struct{} {
	return b.flushSignal
}

// Len returns the number of buffered chunks.
func (b *Buffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.chunks)
}

// DrainAll returns and removes all buffered chunks atomically.
func (b *Buffer) DrainAll() []Chunk {
	b.mu.Lock()
	defer b.mu.Unlock()

	out := make([]Chunk, len(b.chunks))
	copy(out, b.chunks)
	b.chunks = b.chunks[:0]
	return out
}

// FrameBytes returns the expected byte length of one frame.
func (b *Buffer) FrameBytes() int {
	ms := int(b.frameDur.Milliseconds())
	return BytesPerFrame * ms
}
