// Package audio provides a thread-safe circular ring buffer for real-time PCM audio.
//
// Design goals:
//   - O(1) Push and Pop (fixed-size array, head/tail index arithmetic)
//   - Zero heap allocation after construction (no append/reslice)
//   - Overwrite-on-full semantics: oldest frame is silently discarded so the
//     pipeline never blocks on back-pressure, keeping end-to-end latency stable
//   - Flush() empties the buffer instantly and signals barge-in to the STT goroutine
package audio

import (
	"sync"
	"time"
)

const (
	SampleRate    = 16000 // Hz
	BitDepth      = 16    // bits
	Channels      = 1     // mono
	BytesPerFrame = SampleRate * (BitDepth / 8) * Channels / 1000 // bytes per millisecond
)

// Chunk is a single audio frame with its capture timestamp.
type Chunk struct {
	PCM        []byte
	CapturedAt time.Time
}

// Buffer is a fixed-capacity circular ring buffer of Chunk values.
//
// Internal layout:
//
//	ring[head % cap] → oldest item
//	ring[(head+size-1) % cap] → newest item
//
// All indices wrap modulo cap, so no shifting or copying is ever needed.
type Buffer struct {
	mu          sync.Mutex
	ring        []Chunk // fixed-length backing array, allocated once
	head        int     // index of the oldest element
	size        int     // number of valid elements currently stored
	cap         int     // total capacity
	flushSignal chan struct{}
}

// NewBuffer creates a Buffer sized to hold approximately 500 ms of audio.
// frameDur is the duration of each PCM chunk (default 20 ms).
func NewBuffer(frameDur time.Duration) *Buffer {
	capacity := int(500*time.Millisecond/frameDur) + 1

	// Pre-allocate all Chunk backing slices so Push never allocates
	ring := make([]Chunk, capacity)
	frameBytes := int(frameDur.Milliseconds()) * BytesPerFrame
	for i := range ring {
		ring[i].PCM = make([]byte, frameBytes)
	}

	return &Buffer{
		ring:        ring,
		cap:         capacity,
		flushSignal: make(chan struct{}, 1),
	}
}

// Push copies pcm into the next slot of the ring buffer.
// If the buffer is full the oldest frame is overwritten (head advances).
// The copy avoids retaining a reference to the caller's slice.
func (b *Buffer) Push(pcm []byte) {
	b.mu.Lock()
	defer b.mu.Unlock()

	writeIdx := (b.head + b.size) % b.cap

	// Grow the slot's backing slice only when the incoming frame is larger
	// than what was pre-allocated (rare; handles variable-size inputs gracefully)
	if cap(b.ring[writeIdx].PCM) < len(pcm) {
		b.ring[writeIdx].PCM = make([]byte, len(pcm))
	}
	b.ring[writeIdx].PCM = b.ring[writeIdx].PCM[:len(pcm)]
	copy(b.ring[writeIdx].PCM, pcm)
	b.ring[writeIdx].CapturedAt = time.Now()

	if b.size < b.cap {
		b.size++
	} else {
		// Buffer full: advance head to discard the oldest frame
		b.head = (b.head + 1) % b.cap
	}
}

// Pop removes and returns the oldest chunk. Returns (zero, false) when empty.
func (b *Buffer) Pop() (Chunk, bool) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.size == 0 {
		return Chunk{}, false
	}

	c := b.ring[b.head]
	b.head = (b.head + 1) % b.cap
	b.size--

	// Return a copy of the PCM slice so the slot can be reused safely
	out := Chunk{
		PCM:        make([]byte, len(c.PCM)),
		CapturedAt: c.CapturedAt,
	}
	copy(out.PCM, c.PCM)
	return out, true
}

// Flush atomically resets the buffer to empty and fires the flush signal.
// Called on barge-in detection to stop outbound TTS audio immediately.
func (b *Buffer) Flush() {
	b.mu.Lock()
	b.head = 0
	b.size = 0
	b.mu.Unlock()

	// Non-blocking send: if a signal is already queued, the consumer will see it
	select {
	case b.flushSignal <- struct{}{}:
	default:
	}
}

// FlushSignal returns the channel that receives a value on every Flush() call.
func (b *Buffer) FlushSignal() <-chan struct{} {
	return b.flushSignal
}

// Len returns the number of buffered (unconsumed) chunks.
func (b *Buffer) Len() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.size
}

// DrainAll atomically removes and returns all buffered chunks.
func (b *Buffer) DrainAll() []Chunk {
	b.mu.Lock()
	defer b.mu.Unlock()

	out := make([]Chunk, b.size)
	for i := range out {
		idx := (b.head + i) % b.cap
		out[i] = Chunk{
			PCM:        append([]byte(nil), b.ring[idx].PCM...),
			CapturedAt: b.ring[idx].CapturedAt,
		}
	}
	b.head = 0
	b.size = 0
	return out
}

// FrameBytes returns the expected byte length of one frame based on the
// pre-allocated slot size. Useful for callers that need to know the chunk size.
func (b *Buffer) FrameBytes() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.cap == 0 {
		return 0
	}
	return len(b.ring[0].PCM)
}
