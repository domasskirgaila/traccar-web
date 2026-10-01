import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import * as maplibregl from 'maplibre-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { map } from '../../../map/core/MapView';
import { findFonts, geofenceToFeature, geometryToArea } from '../../../map/core/mapUtil';
import drawTheme from '../../../map/draw/theme';

MapboxDraw.constants.classes.CONTROL_BASE = 'maplibregl-ctrl';
MapboxDraw.constants.classes.CONTROL_PREFIX = 'maplibregl-ctrl-';
MapboxDraw.constants.classes.CONTROL_GROUP = 'maplibregl-ctrl-group';

// Drawing and editing geofences on the map. Unlike the old UI component it does not save or
// navigate by itself; the page decides what happens with a drawn or changed shape.
const GeofenceDraw = ({ geofences, selectedId, onCreate, onChange, onDelete }) => {
  const theme = useTheme();

  const draw = useMemo(
    () =>
      new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, line_string: true, trash: true },
        userProperties: true,
        styles: [
          ...drawTheme,
          {
            id: 'gl-draw-title',
            type: 'symbol',
            filter: ['all'],
            layout: {
              'text-field': '{user_name}',
              'text-font': findFonts(map),
              'text-size': 12,
            },
            paint: { 'text-halo-color': 'white', 'text-halo-width': 1 },
          },
        ],
      }),
    [],
  );

  // Listeners read the latest callbacks without re-registering on every render.
  const callbacksRef = useRef({ onCreate, onChange, onDelete });
  callbacksRef.current = { onCreate, onChange, onDelete };

  useEffect(() => {
    map.addControl(draw, theme.direction === 'rtl' ? 'top-right' : 'top-left');
    return () => map.removeControl(draw);
  }, [draw, theme.direction]);

  useEffect(() => {
    const created = (event) => {
      const feature = event.features[0];
      draw.delete(feature.id);
      callbacksRef.current.onCreate(geometryToArea(feature.geometry));
    };
    const updated = (event) => {
      const feature = event.features[0];
      callbacksRef.current.onChange(feature.id, geometryToArea(feature.geometry));
    };
    const deleted = (event) => {
      callbacksRef.current.onDelete(event.features[0].id);
    };
    map.on('draw.create', created);
    map.on('draw.update', updated);
    map.on('draw.delete', deleted);
    return () => {
      map.off('draw.create', created);
      map.off('draw.update', updated);
      map.off('draw.delete', deleted);
    };
  }, [draw]);

  useEffect(() => {
    draw.deleteAll();
    geofences.forEach((geofence) => draw.add(geofenceToFeature(theme, geofence)));
  }, [geofences, draw, theme]);

  useEffect(() => {
    const feature = selectedId && draw.get(selectedId);
    if (!feature) {
      return;
    }
    let { coordinates } = feature.geometry;
    if (feature.geometry.type === 'Point') {
      map.easeTo({ center: coordinates, zoom: Math.max(map.getZoom(), 14) });
      return;
    }
    if (Array.isArray(coordinates[0][0])) {
      [coordinates] = coordinates;
    }
    const bounds = coordinates.reduce(
      (result, coordinate) => result.extend(coordinate),
      new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
    );
    const canvas = map.getCanvas();
    map.fitBounds(bounds, { padding: Math.min(canvas.width, canvas.height) * 0.1 });
  }, [selectedId, draw, geofences]);

  return null;
};

export default GeofenceDraw;
