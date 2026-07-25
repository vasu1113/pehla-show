/**
 * THE DATA CONTRACT — the single source of truth for the Run shape.
 *
 * Everything renders from one Run object. Never invent fields, never reshape it.
 * Written by the orchestrator; read by every panel; owned by none of them.
 * (JSDoc typedefs — the repo is plain JS, so this documents rather than enforces.)
 *
 * Field rules (enforced by reviewers, not the type system):
 *  - audience[] is always exactly 30. seat is 0..29 → seatPosition(seat).
 *  - left_at_sec: null means the person stayed to the end.
 *  - patience_trace length === beats.length + 1. Index 0 is starting patience.
 *  - notes[] REQUIRE beat_id. Never render a note without one.
 *  - All human-readable copy comes from *_label / consensus_line. UI never writes its own.
 *  - film_frames and audio are nullable — handle gracefully, screen never blank.
 */

/**
 * @typedef {Object} Beat
 * @property {number} id
 * @property {number} start_sec
 * @property {number} end_sec
 * @property {string} text_span
 * @property {'exposition'|'inciting'|'rising'|'turn'|'climax'|'quiet'|'reveal'|'resolution'} type
 * @property {number} tension_delta  // signed; drives the film's brightness glow
 */

/**
 * @typedef {Object} Cohort
 * @property {string} id
 * @property {string} label
 * @property {string} context
 * @property {number} seat_count
 * @property {number} retained_pct   // 0..1, never rounded to whole in UI
 * @property {number} calibrated_from // # of real abandonment statements behind it
 */

/**
 * @typedef {Object} AudienceMember
 * @property {number} seat            // 0..29
 * @property {string} cohort
 * @property {string} name
 * @property {number} start_patience
 * @property {number|null} left_at_sec  // null = stayed
 * @property {number|null} left_at_beat
 * @property {string} reason_code
 * @property {string} reason_label
 * @property {string} evidence
 * @property {number[]} patience_trace  // length beats.length + 1
 */

/**
 * @typedef {Object} DropEvent
 * @property {string} id
 * @property {number} timestamp
 * @property {number} beat_id
 * @property {number[]} seats_lost
 * @property {Object.<string, number>} cohort_breakdown
 * @property {string} reason_code
 * @property {string} reason_label
 * @property {string} evidence
 * @property {'structural'|'pacing'|'character'|'tonal'} kind
 */

/**
 * @typedef {Object} Agent
 * @property {string} id
 * @property {string} label
 * @property {string} lens
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {string} agent_id
 * @property {number} beat_id          // REQUIRED — filter out any note lacking it
 * @property {string|null} anchored_to_drop
 * @property {string} note_type
 * @property {string} note_label
 * @property {string} text
 * @property {string} evidence
 * @property {number} severity         // 1..3
 * @property {string[]} agrees_with
 * @property {string[]} disagrees_with
 */

/**
 * @typedef {Object} RoomSynthesis
 * @property {{beat_id:number, claim:string, agents:string[]}[]} consensus
 * @property {{beat_id:number, position_a:{agents:string[],claim:string}, position_b:{agents:string[],claim:string}}[]} conflict
 * @property {string} recommended_fix
 * @property {number} predicted_seats_saved
 */

/**
 * @typedef {Object} Summary
 * @property {number} retained_pct     // 0..1
 * @property {number} seats_total
 * @property {number} seats_retained
 * @property {{timestamp:number, seats_lost:number, reason_label:string}[]} top_losses
 * @property {string} consensus_line
 * @property {string} recommended_fix
 * @property {number} predicted_seats_saved
 */

/**
 * @typedef {Object} Run
 * @property {string} run_id
 * @property {'original'|'fixed'} variant
 * @property {{title:string, duration_sec:number}} script
 * @property {Beat[]} beats
 * @property {Cohort[]} cohorts
 * @property {AudienceMember[]} audience   // exactly 30
 * @property {DropEvent[]} drop_events
 * @property {Agent[]} agents
 * @property {Note[]} notes
 * @property {RoomSynthesis} room_synthesis
 * @property {{beat_id:number, image_url:string}[]|null} film_frames
 * @property {Summary} summary
 * @property {{before_url:string|null, after_url:string|null, section_start_sec:number, section_end_sec:number}} audio
 * @property {string[]} warnings
 */

export {};
