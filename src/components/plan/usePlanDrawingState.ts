import { useState } from 'react';
import type { MapObjectType } from '../../store/types';

type Point = { x: number; y: number };

export const usePlanDrawingState = () => {
  const [roomDrawMode, setRoomDrawMode] = useState<'rect' | 'poly' | null>(null);
  const [corridorDrawMode, setCorridorDrawMode] = useState<'poly' | null>(null);
  const [wallDrawMode, setWallDrawMode] = useState(false);
  const [wallDrawType, setWallDrawType] = useState<MapObjectType | null>(null);
  const [wallDraftPoints, setWallDraftPoints] = useState<Point[]>([]);
  const [wallDraftPointer, setWallDraftPointer] = useState<Point | null>(null);

  const [scaleMode, setScaleMode] = useState(false);
  const [scaleDraft, setScaleDraft] = useState<{ start?: Point; end?: Point } | null>(null);
  const [scaleDraftPointer, setScaleDraftPointer] = useState<Point | null>(null);
  const [scaleModal, setScaleModal] = useState<{ start: Point; end: Point; distance: number } | null>(null);
  const [scaleMetersInput, setScaleMetersInput] = useState('');
  const [showScaleLine, setShowScaleLine] = useState(true);

  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<Point[]>([]);
  const [measurePointer, setMeasurePointer] = useState<Point | null>(null);
  const [measureClosed, setMeasureClosed] = useState(false);
  const [measureFinished, setMeasureFinished] = useState(false);

  const [quoteMode, setQuoteMode] = useState(false);
  const [quotePoints, setQuotePoints] = useState<Point[]>([]);
  const [quotePointer, setQuotePointer] = useState<Point | null>(null);

  return {
    roomDrawMode,
    setRoomDrawMode,
    corridorDrawMode,
    setCorridorDrawMode,
    wallDrawMode,
    setWallDrawMode,
    wallDrawType,
    setWallDrawType,
    wallDraftPoints,
    setWallDraftPoints,
    wallDraftPointer,
    setWallDraftPointer,
    scaleMode,
    setScaleMode,
    scaleDraft,
    setScaleDraft,
    scaleDraftPointer,
    setScaleDraftPointer,
    scaleModal,
    setScaleModal,
    scaleMetersInput,
    setScaleMetersInput,
    showScaleLine,
    setShowScaleLine,
    measureMode,
    setMeasureMode,
    measurePoints,
    setMeasurePoints,
    measurePointer,
    setMeasurePointer,
    measureClosed,
    setMeasureClosed,
    measureFinished,
    setMeasureFinished,
    quoteMode,
    setQuoteMode,
    quotePoints,
    setQuotePoints,
    quotePointer,
    setQuotePointer
  };
};
