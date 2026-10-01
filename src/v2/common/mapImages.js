import { useEffect, useState } from 'react';

// Map icons are prepared once at start-up. They live in a separate chunk together with the map
// engine, so pages without a map load faster; map pages wait for this before showing the map,
// because the map only picks up icons that exist when its style loads.
export const mapImagesReady = import('../../map/core/preloadImages').then(
  ({ default: preloadImages }) => preloadImages(),
);

let ready = false;
mapImagesReady.then(() => {
  ready = true;
});

export const useMapImagesReady = () => {
  const [value, setValue] = useState(ready);
  useEffect(() => {
    let active = true;
    mapImagesReady.then(() => active && setValue(true));
    return () => {
      active = false;
    };
  }, []);
  return value;
};
