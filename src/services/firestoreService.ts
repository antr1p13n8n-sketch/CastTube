import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Channel, ChannelGroup, Video, ThemeMode } from '../types';

// Helper to truncate strings to blueprint maxLength
function clampStr(val: string | undefined | null, maxLen: number): string {
  if (!val) return '';
  return val.length > maxLen ? val.slice(0, maxLen) : val;
}

// Sanitize ID to match ^[a-zA-Z0-9_\-]+$
function isValidDocId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && id.length <= 128 && /^[a-zA-Z0-9_\-]+$/.test(id);
}

export async function ensureUserProfile(user: User, themePreference: ThemeMode): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        displayName: clampStr(user.displayName || 'Pengguna CastTube', 120),
        email: clampStr(user.email || '', 256),
        photoURL: clampStr(user.photoURL || '', 1000),
        themePreference,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        displayName: clampStr(user.displayName || 'Pengguna CastTube', 120),
        photoURL: clampStr(user.photoURL || '', 1000),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateThemeInFirestore(userId: string, theme: ThemeMode): Promise<void> {
  const path = `users/${userId}`;
  try {
    await updateDoc(doc(db, 'users', userId), {
      themePreference: theme,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeToUserGroups(
  userId: string,
  onData: (groups: ChannelGroup[]) => void
): Unsubscribe {
  const path = `users/${userId}/groups`;
  const q = query(collection(db, 'users', userId, 'groups'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: ChannelGroup[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: d.id,
          name: d.name,
          isDefault: Boolean(d.isDefault),
        });
      });
      // Ensure 'all' group is always first
      list.sort((a, b) => {
        if (a.id === 'all') return -1;
        if (b.id === 'all') return 1;
        if (a.id === 'general') return 1;
        if (b.id === 'general') return -1;
        return a.name.localeCompare(b.name);
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToUserChannels(
  userId: string,
  onData: (channels: Channel[]) => void
): Unsubscribe {
  const path = `users/${userId}/channels`;
  const q = query(collection(db, 'users', userId, 'channels'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Channel[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: d.id,
          title: d.title,
          handle: d.handle,
          avatar: d.avatar,
          description: d.description,
          url: d.url,
          groupId: d.groupId,
          addedAt: d.addedAt,
          videoCount: d.videoCount,
        });
      });
      list.sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToUserVideos(
  userId: string,
  onData: (videos: Video[]) => void
): Unsubscribe {
  const path = `users/${userId}/videos`;
  const q = query(collection(db, 'users', userId, 'videos'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Video[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        list.push({
          id: d.id,
          title: d.title,
          publishedAt: d.publishedAt,
          thumbnail: d.thumbnail,
          channelId: d.channelId,
          channelTitle: d.channelTitle,
          description: d.description,
          views: d.views,
          duration: d.duration,
        });
      });
      list.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function seedInitialDataIfEmpty(
  userId: string,
  localGroups: ChannelGroup[],
  localChannels: Channel[],
  localVideos: Video[]
): Promise<void> {
  const groupsPath = `users/${userId}/groups`;
  try {
    const existingGroups = await getDocs(
      query(collection(db, 'users', userId, 'groups'), where('ownerId', '==', userId))
    );
    if (!existingGroups.empty) {
      return; // User already has cloud data
    }

    const batch = writeBatch(db);

    for (const g of localGroups) {
      if (!isValidDocId(g.id)) continue;
      const ref = doc(db, 'users', userId, 'groups', g.id);
      batch.set(ref, {
        id: g.id,
        name: clampStr(g.name || 'Grup', 80),
        ...(g.isDefault !== undefined ? { isDefault: Boolean(g.isDefault) } : {}),
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const c of localChannels) {
      if (!isValidDocId(c.id) || !isValidDocId(c.groupId)) continue;
      const ref = doc(db, 'users', userId, 'channels', c.id);
      batch.set(ref, {
        id: c.id,
        title: clampStr(c.title || 'YouTube Channel', 200),
        ...(c.handle ? { handle: clampStr(c.handle, 100) } : {}),
        ...(c.avatar ? { avatar: clampStr(c.avatar, 1000) } : {}),
        ...(c.description ? { description: clampStr(c.description, 2000) } : {}),
        url: clampStr(c.url || `https://www.youtube.com/channel/${c.id}`, 1000),
        groupId: c.groupId,
        addedAt: clampStr(c.addedAt || new Date().toISOString(), 64),
        ...(typeof c.videoCount === 'number' ? { videoCount: c.videoCount } : {}),
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const v of localVideos.slice(0, 60)) {
      if (!isValidDocId(v.id) || !isValidDocId(v.channelId)) continue;
      const ref = doc(db, 'users', userId, 'videos', v.id);
      batch.set(ref, {
        id: v.id,
        title: clampStr(v.title || 'Untitled Video', 300),
        publishedAt: clampStr(v.publishedAt || new Date().toISOString(), 64),
        thumbnail: clampStr(v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, 1000),
        channelId: v.channelId,
        channelTitle: clampStr(v.channelTitle || 'YouTube Channel', 200),
        description: clampStr(v.description || '', 5000),
        ...(v.views ? { views: clampStr(v.views, 64) } : {}),
        ...(v.duration ? { duration: clampStr(v.duration, 32) } : {}),
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, groupsPath);
  }
}

export async function createGroupInFirestore(userId: string, group: ChannelGroup): Promise<void> {
  const path = `users/${userId}/groups/${group.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'groups', group.id), {
      id: group.id,
      name: clampStr(group.name, 80),
      ...(group.isDefault !== undefined ? { isDefault: Boolean(group.isDefault) } : {}),
      ownerId: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function renameGroupInFirestore(
  userId: string,
  groupId: string,
  newName: string
): Promise<void> {
  const path = `users/${userId}/groups/${groupId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'groups', groupId), {
      name: clampStr(newName, 80),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteGroupInFirestore(
  userId: string,
  groupId: string,
  channelsInGroup: Channel[]
): Promise<void> {
  const path = `users/${userId}/groups/${groupId}`;
  try {
    const batch = writeBatch(db);
    for (const ch of channelsInGroup) {
      batch.update(doc(db, 'users', userId, 'channels', ch.id), {
        groupId: 'general',
        updatedAt: serverTimestamp(),
      });
    }
    batch.delete(doc(db, 'users', userId, 'groups', groupId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveChannelInFirestore(userId: string, channel: Channel): Promise<void> {
  if (!isValidDocId(channel.id)) return;
  const path = `users/${userId}/channels/${channel.id}`;
  try {
    const ref = doc(db, 'users', userId, 'channels', channel.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        id: channel.id,
        title: clampStr(channel.title || 'YouTube Channel', 200),
        ...(channel.handle ? { handle: clampStr(channel.handle, 100) } : {}),
        ...(channel.avatar ? { avatar: clampStr(channel.avatar, 1000) } : {}),
        ...(channel.description ? { description: clampStr(channel.description, 2000) } : {}),
        url: clampStr(channel.url || `https://www.youtube.com/channel/${channel.id}`, 1000),
        groupId: isValidDocId(channel.groupId) ? channel.groupId : 'general',
        addedAt: clampStr(channel.addedAt || new Date().toISOString(), 64),
        ...(typeof channel.videoCount === 'number' ? { videoCount: channel.videoCount } : {}),
        ownerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        title: clampStr(channel.title || 'YouTube Channel', 200),
        ...(channel.handle ? { handle: clampStr(channel.handle, 100) } : {}),
        ...(channel.avatar ? { avatar: clampStr(channel.avatar, 1000) } : {}),
        ...(channel.description ? { description: clampStr(channel.description, 2000) } : {}),
        ...(typeof channel.videoCount === 'number' ? { videoCount: channel.videoCount } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function changeChannelGroupInFirestore(
  userId: string,
  channelId: string,
  newGroupId: string
): Promise<void> {
  const path = `users/${userId}/channels/${channelId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'channels', channelId), {
      groupId: newGroupId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteChannelInFirestore(
  userId: string,
  channelId: string,
  videoIdsToDelete: string[]
): Promise<void> {
  const path = `users/${userId}/channels/${channelId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'users', userId, 'channels', channelId));
    for (const vidId of videoIdsToDelete.slice(0, 400)) {
      if (isValidDocId(vidId)) {
        batch.delete(doc(db, 'users', userId, 'videos', vidId));
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveVideosInFirestore(userId: string, videos: Video[]): Promise<void> {
  const path = `users/${userId}/videos`;
  try {
    // Only create/update up to 50 newest videos per batch to stay within free tier limits
    const validVideos = videos.filter((v) => isValidDocId(v.id) && isValidDocId(v.channelId)).slice(0, 50);
    for (const v of validVideos) {
      const ref = doc(db, 'users', userId, 'videos', v.id);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          id: v.id,
          title: clampStr(v.title || 'Untitled Video', 300),
          publishedAt: clampStr(v.publishedAt || new Date().toISOString(), 64),
          thumbnail: clampStr(v.thumbnail || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`, 1000),
          channelId: v.channelId,
          channelTitle: clampStr(v.channelTitle || 'YouTube Channel', 200),
          description: clampStr(v.description || '', 5000),
          ...(v.views ? { views: clampStr(v.views, 64) } : {}),
          ...(v.duration ? { duration: clampStr(v.duration, 32) } : {}),
          ownerId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
