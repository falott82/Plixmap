/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from 'react';
import type { MapObjectType } from '../../store/types';
import { runHandleCreate, runHandleUpdate, runHandlePlaceNew, type HandleCreatePayload } from './planViewCreateObject';

// Object create/place/update handlers extracted from usePlanView. Each delegates to the matching
// run* helper with a deps object; grouped here so the shared deps are passed once. Bodies moved
// verbatim (handlers are recreated each render exactly as before — they were plain consts).
export const usePlanObjectCreateHandlers = (deps: any) => {
  const {
    isReadOnly, panToolActive, setPanToolActive, shouldConfirmCapacity, proceedPlaceUser, isDeskType,
    plan, markTouched, getTypeLabel, addObject, defaultObjectScale, ensureObjectLayerVisible,
    lastInsertedRef, getRoomIdAt, updateObject, push, t, postAuditEvent, setModalState, setPendingType,
    modalState, lastQuoteLabelPosH, lastQuoteLabelBg, isCameraType, lastQuoteColor, lastQuoteLabelScale,
    lastQuoteLabelColor, lastQuoteDashed, lastQuoteEndpoint, getTypeLayerIds, inferDefaultLayerIds,
    layerIdSet, setLastQuoteScale, setLastQuoteColor, setLastQuoteLabelScale, setLastQuoteLabelBg,
    setLastQuoteLabelColor, setLastQuoteLabelPosH, setLastQuoteLabelPosV, setLastQuoteDashed,
    setLastQuoteEndpoint, setLastObjectScale, resolveRoomAssignmentForObject, isUserType,
    notifyNonPeopleRoomBlocked, saveCustomValues, getQuoteOrientation, planId
  } = deps;

  const getCameraDefaults = useCallback(
    () => ({
      rotation: 0,
      cctvRange: 160,
      cctvAngle: 70,
      cctvOpacity: 0.6
    }),
    []
  );

  const handlePlaceNew = (
    type: MapObjectType,
    x: number,
    y: number,
    options?: { textBoxWidth?: number; textBoxHeight?: number }
  ) => {
    runHandlePlaceNew(type, x, y, options, {
      isReadOnly,
      panToolActive,
      setPanToolActive,
      shouldConfirmCapacity,
      proceedPlaceUser,
      isDeskType,
      plan,
      markTouched,
      getTypeLabel,
      addObject,
      defaultObjectScale,
      ensureObjectLayerVisible,
      lastInsertedRef,
      getRoomIdAt,
      updateObject,
      push,
      t,
      postAuditEvent,
      setModalState,
      setPendingType
    });
  };

  const handleCreate = (payload: HandleCreatePayload) => {
    runHandleCreate(payload, {
      plan,
      modalState,
      isReadOnly,
      markTouched,
      defaultObjectScale,
      lastQuoteLabelPosH,
      lastQuoteLabelBg,
      isCameraType,
      getCameraDefaults,
      lastQuoteColor,
      lastQuoteLabelScale,
      lastQuoteLabelColor,
      lastQuoteDashed,
      lastQuoteEndpoint,
      getTypeLayerIds,
      inferDefaultLayerIds,
      layerIdSet,
      addObject,
      ensureObjectLayerVisible,
      setLastQuoteScale,
      setLastQuoteColor,
      setLastQuoteLabelScale,
      setLastQuoteLabelBg,
      setLastQuoteLabelColor,
      setLastQuoteLabelPosH,
      setLastQuoteLabelPosV,
      setLastQuoteDashed,
      setLastQuoteEndpoint,
      setLastObjectScale,
      lastInsertedRef,
      getRoomIdAt,
      resolveRoomAssignmentForObject,
      isUserType,
      notifyNonPeopleRoomBlocked,
      updateObject,
      saveCustomValues,
      push,
      t,
      postAuditEvent,
      getQuoteOrientation
    });
  };

  const handleUpdate = (payload: HandleCreatePayload) => {
    runHandleUpdate(payload, {
      modalState,
      isReadOnly,
      markTouched,
      plan,
      updateObject,
      setLastQuoteScale,
      setLastQuoteLabelScale,
      setLastQuoteLabelBg,
      setLastQuoteLabelColor,
      getQuoteOrientation,
      setLastQuoteLabelPosV,
      setLastQuoteLabelPosH,
      setLastQuoteColor,
      setLastQuoteDashed,
      setLastQuoteEndpoint,
      setLastObjectScale,
      saveCustomValues,
      push,
      t,
      postAuditEvent,
      planId
    });
  };

  return { handlePlaceNew, handleCreate, handleUpdate, getCameraDefaults };
};
