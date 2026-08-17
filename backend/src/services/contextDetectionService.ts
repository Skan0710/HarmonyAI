import {
  ContextPreference,
  ContextTimeOfDay,
  ContextMood,
  ContextActivity,
  validateAndSanitizeContextPreference,
} from '../schemas/contextPreferenceSchema.js';

export class ContextDetectionService {
  /**
   * Deterministically classifies a Date's hour into time-of-day categories:
   * - Morning: 05:00 - 11:59 (5 - 11)
   * - Afternoon: 12:00 - 16:59 (12 - 16)
   * - Evening: 17:00 - 21:59 (17 - 21)
   * - Night: 22:00 - 04:59 (22 - 4)
   * Accepts an optional Date instance for 100% testability.
   */
  static detectTimeOfDayCategory(date: Date = new Date()): ContextTimeOfDay {
    const hour = date.getHours();

    if (hour >= 5 && hour < 12) {
      return ContextTimeOfDay.Morning;
    }
    if (hour >= 12 && hour < 17) {
      return ContextTimeOfDay.Afternoon;
    }
    if (hour >= 17 && hour < 22) {
      return ContextTimeOfDay.Evening;
    }
    return ContextTimeOfDay.Night;
  }

  /**
   * Derives default mood from explicit activity if mood is not explicitly provided.
   */
  private static deriveMoodFromActivity(activity?: ContextActivity): ContextMood | undefined {
    if (!activity) return undefined;
    switch (activity) {
      case ContextActivity.Workout:
        return ContextMood.Energetic;
      case ContextActivity.Study:
      case ContextActivity.Coding:
        return ContextMood.Focus;
      case ContextActivity.Party:
        return ContextMood.Upbeat;
      case ContextActivity.Relaxing:
      case ContextActivity.Sleeping:
        return ContextMood.Chill;
      case ContextActivity.Commute:
        return ContextMood.Relaxed;
      default:
        return undefined;
    }
  }

  /**
   * Derives default energy level from explicit activity if energyLevel is not provided.
   */
  private static deriveEnergyFromActivity(activity?: ContextActivity): number | undefined {
    if (!activity) return undefined;
    switch (activity) {
      case ContextActivity.Workout:
      case ContextActivity.Party:
        return 0.85;
      case ContextActivity.Study:
      case ContextActivity.Coding:
        return 0.50;
      case ContextActivity.Relaxing:
        return 0.35;
      case ContextActivity.Sleeping:
        return 0.15;
      case ContextActivity.Commute:
        return 0.60;
      default:
        return undefined;
    }
  }

  /**
   * Detects and returns a normalized context preference object.
   * - Automatically detects current time-of-day category from date.
   * - Merges optional explicit context parameters (activity, mood, energyLevel, language, etc.).
   * - Applies deterministic heuristic fallbacks when explicit activity is provided.
   * - Strictly deterministic, testable, and without LLM overhead.
   */
  static detectCurrentContext(params?: {
    date?: Date;
    explicitContext?: Partial<ContextPreference>;
  }): ContextPreference {
    const targetDate = params?.date || new Date();
    const explicit = params?.explicitContext || {};

    // 1. Detect Time of Day
    const timeOfDay = explicit.timeOfDay || this.detectTimeOfDayCategory(targetDate);

    // 2. Derive Mood & Energy from Activity if omitted
    const mood = explicit.mood || this.deriveMoodFromActivity(explicit.activity);
    const energyLevel =
      explicit.energyLevel ?? this.deriveEnergyFromActivity(explicit.activity);

    const mergedRaw = {
      ...explicit,
      timeOfDay,
      mood,
      energyLevel,
    };

    return validateAndSanitizeContextPreference(mergedRaw);
  }
}
