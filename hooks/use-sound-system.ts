"use client";

import { useCallback, useEffect, useState } from "react";

type SoundName =
  | "messageSent"
  | "messageReceived"
  | "notification"
  | "warning"
  | "incomingCall"
  | "callEnded"
  | "tap"
  | "safe"
  | "report";

type SoundSettings = {
  muted: boolean;
  messageSounds: boolean;
  callSounds: boolean;
  warningSounds: boolean;
  tapSounds: boolean;
};

const defaultSettings: SoundSettings = {
  muted: false,
  messageSounds: true,
  callSounds: true,
  warningSounds: true,
  tapSounds: false
};

const storageKey = "purechat:sound-settings";
let soundUnlocked = false;

export function getSoundSettings(): SoundSettings {
  if (typeof window === "undefined") return defaultSettings;
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return defaultSettings;
  try {
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSoundSettings(settings: SoundSettings) {
  window.localStorage.setItem(storageKey, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("purechat:sound-settings-changed", { detail: settings }));
}

export function canUseBrowserNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!canUseBrowserNotifications()) return "unsupported" as const;
  if (Notification.permission === "granted") return "granted" as const;
  if (Notification.permission === "denied") return "denied" as const;
  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, options?: NotificationOptions) {
  if (!canUseBrowserNotifications() || Notification.permission !== "granted") return;
  new Notification(title, {
    badge: "/icon.png",
    icon: "/icon.png",
    ...options
  });
}

export function useSoundSystem() {
  const [settings, setSettings] = useState<SoundSettings>(defaultSettings);

  useEffect(() => {
    setSettings(getSoundSettings());

    const unlock = () => {
      soundUnlocked = true;
    };
    const listener = (event: Event) => {
      const next = (event as CustomEvent<SoundSettings>).detail ?? getSoundSettings();
      setSettings(next);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("purechat:sound-settings-changed", listener);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("purechat:sound-settings-changed", listener);
    };
  }, []);

  const play = useCallback((name: SoundName) => {
    if (!soundUnlocked) return;
    const current = getSoundSettings();
    if (current.muted) return;
    if ((name === "messageSent" || name === "messageReceived") && !current.messageSounds) return;
    if ((name === "incomingCall" || name === "callEnded") && !current.callSounds) return;
    if (name === "warning" && !current.warningSounds) return;
    if (name === "tap" && !current.tapSounds) return;

    playTone(name);
  }, []);

  return { settings, play };
}

function playTone(name: SoundName) {
  const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.025, context.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.55);
  gain.connect(context.destination);

  const now = context.currentTime;
  const sequence = getSequence(name);
  sequence.forEach(([frequency, start, duration]) => {
    const oscillator = context.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    oscillator.start(now + start);
    oscillator.stop(now + start + duration);
  });

  window.setTimeout(() => void context.close(), 900);
}

function getSequence(name: SoundName): Array<[number, number, number]> {
  switch (name) {
    case "messageSent":
      return [[520, 0, 0.055], [740, 0.07, 0.065]];
    case "messageReceived":
      return [[640, 0, 0.07], [520, 0.09, 0.075]];
    case "notification":
      return [[620, 0, 0.07], [820, 0.1, 0.075]];
    case "warning":
      return [[320, 0, 0.11], [250, 0.14, 0.12]];
    case "incomingCall":
      return [[520, 0, 0.11], [700, 0.16, 0.11], [520, 0.32, 0.11]];
    case "callEnded":
      return [[420, 0, 0.075], [260, 0.1, 0.1]];
    case "safe":
      return [[540, 0, 0.065], [760, 0.09, 0.08], [920, 0.2, 0.08]];
    case "report":
      return [[360, 0, 0.085], [300, 0.12, 0.095]];
    case "tap":
    default:
      return [[680, 0, 0.035]];
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
