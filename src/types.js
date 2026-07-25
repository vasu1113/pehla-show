/**
 * THE DATA CONTRACT — the single source of truth for the Run shape.
 *
 * Everything renders from one Run object. Never invent fields, never reshape it.
 * Written by the orchestrator; read by every panel; owned by none of them.
 * (JSDoc typedefs — the repo is plain JS, so this documents rather than enforces.)
 *
 * This file MIRRORS api/app/models.py. That file is the contract; this one is
 * the reading of it. When they disagree, models.py wins and this is the bug.
 *
 * Field rules (enforced by reviewers, not the type system):
 *  - audience[] is always exactly 30. seat is 0..29.
 *  - left_at_sec: null means the person stayed to the end. Not 0, not -1.
 *  - patience_trace length === beats.length + 1. Index 0 is starting patience.
 *  - notes[] REQUIRE beat_id. Never render a note without one.
 *  - reason_code is always one of the 17 closed codes. Never a free string.
 *  - All human-readable copy comes from *_label / claim. UI never writes its own.
 *  - room_synthesis, summary and audio are nullable — a degraded run still
 *    renders. Handle the null, never blank the screen.
 */

/**
 * @typedef {'setup'|'exposition'|'conflict'|'reveal'|'banter'|'action'|'cliffhanger'} BeatType
 */

/**
 * The closed vocabulary. A code outside these two lists is a contract
 * violation upstream, not something the UI invents a label for.
 *
 * @typedef {'EXPOSITION_STACK'|'NO_OPEN_QUESTION'|'TROPE_FATIGUE'|'CHARACTER_OVERLOAD'
 *          |'UNCLEAR_POV'|'STAKES_TOO_LOW'|'PACING_FLAT'|'PAYOFF_TOO_FAR'
 *          |'TONAL_WHIPLASH'|'DIALOGUE_UNVOICED'} DrainCode
 * @typedef {'QUESTION_OPENED'|'STAKES_ESCALATED'|'NOVEL_PREMISE'|'EMOTIONAL_HIT'
 *          |'TENSION_SPIKE'|'TROPE_HIT'|'VOICE_DISTINCTIVE'} RefillCode
 * @typedef {DrainCode|RefillCode} ReasonCode
 */

/**
 * @typedef {Object} Beat
 * @property {number} id
 * @property {number} index
 * @property {number} start_sec
 * @property {number} end_sec
 * @property {string} text_span
 * @property {BeatType} type
 * @property {number} tension_delta   // -3..3; drives the film's brightness glow
 * @property {string[]} questions_opened
 * @property {string[]} questions_closed
 * @property {string[]} characters_present
 * @property {number} stakes_level    // 1..5
 */

/**
 * A reusable listener identity, as served by GET /personas.
 * Six of these are chosen per run; each spawns five seats.
 *
 * @typedef {Object} Persona
 * @property {string} id
 * @property {string} label
 * @property {string|null} persona_type
 * @property {string} prompt            // the scorer brief. NOT "context".
 * @property {number} calibrated_from   // real abandonment statements behind it; 0 until mined
 */

/**
 * One of the six chosen personas, as it appears inside a Run.
 *
 * @typedef {Object} Cohort
 * @property {string} id
 * @property {string} label
 * @property {string} context
 * @property {number} seat_count
 * @property {number} retained_pct   // 0..1, never rounded to whole in UI
 */

/**
 * @typedef {Object} AudienceMember
 * @property {number} seat            // 0..29
 * @property {string} cohort
 * @property {string} persona_id      // which library persona they were spawned from
 * @property {number} variant_index   // 0..4 — which of the five patience variants
 * @property {string} name
 * @property {number} start_patience
 * @property {number|null} left_at_sec    // null = stayed to the end
 * @property {number|null} left_at_beat
 * @property {ReasonCode|null} reason_code   // null iff they stayed
 * @property {string|null} reason_label
 * @property {string|null} evidence
 * @property {number[]} patience_trace  // length beats.length + 1
 */

/**
 * A real, short cohort response generated during the blinded score. The UI
 * reveals it at its beat; it does not invent copy or stream a new model call.
 *
 * @typedef {Object} AudienceReaction
 * @property {string} cohort
 * @property {number} beat_id
 * @property {number} timestamp
 * @property {number} delta
 * @property {ReasonCode} reason_code
 * @property {string} evidence
 * @property {string} text
 */

/**
 * @typedef {Object} DropEvent
 * @property {string} id
 * @property {number} timestamp
 * @property {number} beat_id
 * @property {number[]} seats_lost
 * @property {Object.<string, number>} cohort_breakdown
 * @property {ReasonCode} reason_code
 * @property {string} reason_label
 * @property {string} evidence
 * @property {'structural'|'taste_split'} kind
 *   // structural — leavers span cohorts, the writing is broken there.
 *   // taste_split — one cohort left while another sailed through.
 */

/**
 * @typedef {'director'|'editor'|'critic'|'psychologist'|'historian'} AgentId
 */

/**
 * @typedef {Object} Agent
 * @property {AgentId} id
 * @property {string} label
 * @property {string} lens
 */

/**
 * @typedef {Object} Note
 * @property {string} id
 * @property {AgentId} agent_id
 * @property {number} beat_id          // REQUIRED — filter out any note lacking it
 * @property {string|null} anchored_to_drop
 * @property {string} note_type        // closed per agent; see NOTE_TYPES_BY_AGENT
 * @property {string} note_label
 * @property {string} text
 * @property {string} evidence
 * @property {number} severity         // 1..5
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
 * @property {number|null} biggest_cliff_sec
 * @property {Object.<string, number>} cohort_retention   // cohort id -> 0..1
 */

/**
 * @typedef {Object} Warning
 * @property {string} code       // e.g. COHORT_DROPPED, BEATS_DEGRADED
 * @property {string} message
 */

/**
 * @typedef {Object} Run
 * @property {string} contract_version
 * @property {string} run_id
 * @property {string|null} parent_run_id
 * @property {'original'|'fixed'} variant
 * @property {'analysing'|'ready'|'error'} status
 * @property {string} created_at
 * @property {{id:string, title:string, duration_sec:number, word_count:number}} script
 * @property {Beat[]} beats
 * @property {Cohort[]} cohorts
 * @property {AudienceMember[]} audience   // exactly 30
 * @property {AudienceReaction[]} audience_reactions
 * @property {DropEvent[]} drop_events
 * @property {Agent[]} agents
 * @property {Note[]} notes
 * @property {RoomSynthesis|null} room_synthesis
 * @property {Summary|null} summary
 * @property {{before_url:string|null, after_url:string|null, section_start_sec:number|null, section_end_sec:number|null}|null} audio
 * @property {Warning[]} warnings          // objects, not strings
 */

/**
 * What GET /runs/{id} returns while the run is still analysing.
 *
 * @typedef {'QUEUED'|'PARSING_BEATS'|'SEATING_AUDIENCE'|'SCREENING'
 *          |'CONVENING_ROOM'|'SYNTHESISING'|'READY'|'ERROR'} Stage
 * @typedef {Object} Progress
 * @property {Stage} stage
 * @property {string} message   // exact UI copy from the API. Never paraphrase it.
 * @property {number} pct       // 0..100
 * @property {number} beats_total
 * @property {number} beats_done
 *
 * @typedef {Object} RunStatus
 * @property {string} run_id
 * @property {'analysing'|'ready'|'error'} status
 * @property {Progress|null} progress
 */

export {};
