import { Room } from '../store/types';

export const isNonPeopleRoom = (room: Partial<Room> | null | undefined) => {
  if (!room) return false;
  return !!((room as any).storageRoom || (room as any).bathroom || (room as any).technicalRoom);
};

export const getRoomSpecialType = (room: Partial<Room> | null | undefined): 'storage' | 'bathroom' | 'technical' | null => {
  if (!room) return null;
  if ((room as any).bathroom) return 'bathroom';
  if ((room as any).technicalRoom) return 'technical';
  if ((room as any).storageRoom) return 'storage';
  return null;
};

export const isRoomWithoutWindows = (room: Partial<Room> | null | undefined) => !!room && !!(room as any).noWindows;
