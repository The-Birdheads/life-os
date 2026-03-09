import { Preferences } from '@capacitor/preferences';

const LOCAL_USER_ID_KEY = 'lifeos_local_user_id';

/**
 * Gets the local device UUID.
 * Generates and stores one if it doesn't exist yet.
 */
export async function getLocalUserId(): Promise<string> {
    const { value } = await Preferences.get({ key: LOCAL_USER_ID_KEY });
    if (value) {
        return value;
    }

    const newId = crypto.randomUUID();
    await Preferences.set({ key: LOCAL_USER_ID_KEY, value: newId });
    return newId;
}

/**
 * Clears the local device UUID (useful for testing or resetting).
 */
export async function clearLocalUserId(): Promise<void> {
    await Preferences.remove({ key: LOCAL_USER_ID_KEY });
}
