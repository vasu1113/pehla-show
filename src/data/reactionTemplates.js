/**
 * Reaction templates for various audience cohorts, reason codes, and verdict tiers.
 * Uses realistic Hindi-English listener register without emojis.
 * Contains exactly 54 unique reaction strings.
 */
const reactionTemplates = {
  commuter: {
    slow_start: {
      headshake: "Bhai, traffic scene boring lag raha hai",
      popcorn: "Chalo thik hai, aage badhao"
    },
    melodramatic: {
      headshake: "Dialogue delivery bilkul daily soap jaisa hai",
      popcorn: "Phone call drag ho raha hai"
    },
    barricade_drag: {
      headshake: "Waste of my commute, police barricade scene drags too much",
      popcorn: "Nothing is moving here",
      stands: "Uth ke khada ho gaya to see if anything changes"
    },
    slow_pacing: {
      headshake: "Arey speed badhao, metro late ho rahi hai"
    },
    flat_dialogue: {
      headshake: "Bahut hi wooden lines hain"
    }
  },
  kitchen: {
    slow_start: {
      nod: "Awaaz thik hai par slow shuruaat hai",
      popcorn: "Background music is okay"
    },
    melodramatic: {
      nod: "Aise phone calls serials mein hote hain",
      headshake: "Kuch jyada hi rona dhona hai"
    },
    barricade_drag: {
      headshake: "Frying pan mein pyaz jal gaya par scene wahi hai",
      popcorn: "Isse accha serial dekh leti",
      nod: "Police scene is somewhat okay but draggy"
    },
    slow_pacing: {
      headshake: "Boring lanes, direct dialogue pe aao"
    },
    flat_dialogue: {
      headshake: "Roti belte belte bore ho gayi"
    }
  },
  night_rider: {
    slow_start: {
      headshake: "Kabir driving into traffic takes too long",
      popcorn: "Cab speed is faster than this start"
    },
    melodramatic: {
      nod: "Bhaiya voice tremble real nahi lag raha",
      headshake: "Too theatrical phone conversation"
    },
    barricade_drag: {
      headshake: "Traffic block feels too real, and not in a good way",
      popcorn: "Delhi police blocking everything, skip please",
      stands: "Stuck in back seat waiting for police to move"
    },
    slow_pacing: {
      headshake: "Very slow lanes, auto ka meter chal raha hai"
    },
    flat_dialogue: {
      headshake: "Sasti script lagti hai"
    }
  },
  metro_pro: {
    slow_start: {
      headshake: "The hook is missing, first 30 seconds are empty",
      popcorn: "Okay let us see if it gets better"
    },
    melodramatic: {
      headshake: "Soap opera tropes are showing up early",
      nod: "Standard melodrama in the phone call"
    },
    barricade_drag: {
      headshake: "Poor pacing, barricade scene should have been edited down",
      popcorn: "A massive buzzkill for the tension",
      stands: "Standing on my toes in metro to check screen"
    },
    slow_pacing: {
      headshake: "The lane driving lacks any atmosphere, just dark shadows"
    },
    flat_dialogue: {
      headshake: "The conflict feels artificially constructed and flat"
    }
  },
  sleep: {
    slow_start: {
      headshake: "Too slow, going to sleep if nothing happens",
      popcorn: "Blanket is too comfy for this slow pace"
    },
    melodramatic: {
      nod: "A bit too loud for late night watching",
      headshake: "Very generic high pitch phone acting"
    },
    barricade_drag: {
      headshake: "Sleeping now, barricade discussion is dead silent",
      popcorn: "No tension, eyes closing",
      nod: "Boring police debate"
    },
    slow_pacing: {
      headshake: "Still in the lanes? Goodnight"
    },
    flat_dialogue: {
      headshake: "Cliché dialogue is making me yawn"
    }
  },
  diaspora: {
    slow_start: {
      nod: "Nice Delhi atmosphere but a bit slow",
      popcorn: "Reminds me of home, but get to the point"
    },
    melodramatic: {
      headshake: "A bit melodramatic for a modern show",
      nod: "Acceptable emotional hook"
    },
    barricade_drag: {
      headshake: "Barricades drag on, it could be tighter",
      popcorn: "Feels like standard TV tropes",
      stands: "Anxious for the main lead to cross the block"
    },
    slow_pacing: {
      headshake: "Lane scenes need a bit of music or energy"
    },
    flat_dialogue: {
      headshake: "The flyover conversation has very wooden dialogue"
    }
  }
};

export default reactionTemplates;
