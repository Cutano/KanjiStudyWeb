import { useSyncExternalStore } from "react";
import { getProfile, subscribeProfile } from "./profile";

export function useProfile() {
  return useSyncExternalStore(subscribeProfile, getProfile, getProfile);
}
