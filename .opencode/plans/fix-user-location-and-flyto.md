# Fix: User location not showing on map and no flyTo

## Problem
1. When "Permitir ubicación" is clicked, `userLocation` state is set but the map never flies to that location
2. `UserLocationMarker` never receives `accuracy` so no accuracy circle is shown
3. `LocateButton` does `flyTo` but the auto-flyTo on `userLocation` change is missing

## Changes

### 1. `src/components/map/map-content.tsx` - MapChildren

Add auto-flyTo when `userLocation` changes from null/previous to new coordinates:

```tsx
const lastFlownTo = useRef<{ lat: number; lng: number } | null>(null);

useEffect(() => {
  if (!userLocation) return;
  if (
    lastFlownTo.current &&
    lastFlownTo.current.lat === userLocation.lat &&
    lastFlownTo.current.lng === userLocation.lng
  ) return;
  lastFlownTo.current = userLocation;
  map.flyTo([userLocation.lat, userLocation.lng], 15, { duration: 0.8 });
}, [userLocation, map]);
```

Pass accuracy to UserLocationMarker:
```tsx
accuracy={userLocation.accuracy}
```

### 2. `src/components/map/types.ts` - MapViewProps

Add optional `accuracy` to `userLocation` type:
```ts
userLocation?: { lat: number; lng: number; accuracy?: number } | null;
onUserLocated?: (lat: number, lng: number, accuracy?: number) => void;
```

### 3. `src/app/(main)/home/page.tsx` - handleUserLocated

Update to receive and pass accuracy:
```ts
const handleUserLocated = useCallback((lat: number, lng: number, accuracy?: number) => {
  setUserLocation({ lat, lng, accuracy });
  setSheetState("default");
}, []);
```

Update `handleRequestLocation` success callback to pass `pos.coords.accuracy`.

## Why
- `LocateButton` already does `flyTo` then calls `onUserLocated`. The auto-flyTo prevents a double flyTo (same coords are skipped).
- "Permitir ubicación" flow only sets state without moving map. Auto-flyTo fixes this.
- Accuracy was missing entirely from the data flow.
