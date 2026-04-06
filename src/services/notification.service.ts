// API/도메인 서비스 로직: src/services/notification.service.ts
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { Transaction } from '../types';
import { formatCurrency } from '../utils/currency';
import { supabase } from './supabase';
import { useUIStore } from '../stores/ui.store';

const SHARED_FINANCE_CHANNEL_ID = 'shared-finance';
const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

let initialized = false;
let permissionChecked = false;
let handlerInitialized = false;
let expoGoWarningShown = false;
let projectIdWarningShown = false;
const displayNameCache = new Map<string, string>();
const pushTokenCache = new Map<string, string>();

type NotificationsModule = typeof import('expo-notifications');
let notificationsModule: NotificationsModule | null = null;

const isExpoGo =
  Constants.executionEnvironment === 'storeClient' || Constants.appOwnership === 'expo';

function warnExpoGoOnce() {
  if (expoGoWarningShown) return;
  expoGoWarningShown = true;
  console.warn(
    '[Notifications] Expo Go(Android)에서는 공유 거래 알림이 제한됩니다. 알림 테스트는 Development Build를 사용해주세요.'
  );
}

function showInAppFallbackNotification(title: string, body: string) {
  useUIStore.getState().showInAppNotice(title, body);
}

function isValidExpoPushToken(token: string | null | undefined): token is string {
  if (!token) return false;
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

function getEasProjectId(): string | null {
  const fromExtra = (Constants.expoConfig as any)?.extra?.eas?.projectId as string | undefined;
  const fromEasConfig = (Constants as any)?.easConfig?.projectId as string | undefined;
  const projectId = fromExtra ?? fromEasConfig ?? null;

  if (!projectId || projectId === 'your-eas-project-id') {
    if (!projectIdWarningShown) {
      projectIdWarningShown = true;
      console.warn(
        '[Notifications] app.json의 expo.extra.eas.projectId가 실제 값이 아니어서 푸시 토큰 발급을 건너뜁니다.'
      );
    }
    return null;
  }

  return projectId;
}

async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (Platform.OS === 'web') return null;
  if (isExpoGo) {
    warnExpoGoOnce();
    return null;
  }

  if (notificationsModule) return notificationsModule;

  try {
    notificationsModule = await import('expo-notifications');
    return notificationsModule;
  } catch (error) {
    console.warn('[Notifications] 알림 모듈 로딩에 실패했습니다.', error);
    return null;
  }
}

async function ensureNotificationHandler() {
  if (handlerInitialized) return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  handlerInitialized = true;
}

function getTransactionTypeLabel(type: Transaction['type']): string {
  if (type === 'expense') return '지출';
  if (type === 'income') return '수입';
  return '거래';
}

function getNotificationAmount(tx: Transaction): string {
  if (tx.type === 'expense') {
    return formatCurrency(-Math.abs(tx.amount), true);
  }
  if (tx.type === 'income') {
    return formatCurrency(Math.abs(tx.amount), true);
  }
  return formatCurrency(Math.abs(tx.amount));
}

async function getDisplayName(userId: string): Promise<string | null> {
  if (displayNameCache.has(userId)) {
    return displayNameCache.get(userId) ?? null;
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('display_name')
    .eq('id', userId)
    .single();

  if (error || !data?.display_name) {
    return null;
  }

  displayNameCache.set(userId, data.display_name);
  return data.display_name;
}

type SharedPushRecipient = {
  id: string;
  push_token: string | null;
};

async function getSharedFinanceRecipients(senderUserId: string): Promise<SharedPushRecipient[]> {
  const { data: links, error: linksError } = await supabase
    .from('connections')
    .select('user_a_id,user_b_id,share_finance')
    .eq('share_finance', true)
    .or(`user_a_id.eq.${senderUserId},user_b_id.eq.${senderUserId}`);

  if (linksError || !links || links.length === 0) return [];

  const recipientIds = Array.from(
    new Set(
      links
        .map((link: any) => (
          link.user_a_id === senderUserId ? link.user_b_id : link.user_a_id
        ))
        .filter((id: string) => Boolean(id) && id !== senderUserId)
    )
  );

  if (recipientIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id,push_token')
    .in('id', recipientIds);

  if (profileError || !profiles) return [];
  return profiles as SharedPushRecipient[];
}

export async function initNotifications(): Promise<void> {
  if (initialized) return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  try {
    await ensureNotificationHandler();
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(SHARED_FINANCE_CHANNEL_ID, {
        name: '공유 가계부',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
        lightColor: '#6366F1',
      });
    }
    initialized = true;
  } catch (error) {
    console.warn('[Notifications] 알림 채널 초기화에 실패했습니다.', error);
  }
}

export async function ensureNotificationPermissions(): Promise<void> {
  if (permissionChecked) return;

  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  permissionChecked = true;
  try {
    await ensureNotificationHandler();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return;

    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) {
      console.warn('[Notifications] 알림 권한이 허용되지 않았습니다.');
    }
  } catch (error) {
    console.warn('[Notifications] 알림 권한 확인/요청에 실패했습니다.', error);
  }
}

export async function registerPushTokenForUser(userId: string): Promise<void> {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;

    const projectId = getEasProjectId();
    if (!projectId) return;

    await initNotifications();
    await ensureNotificationPermissions();

    const permissions = await Notifications.getPermissionsAsync();
    if (!permissions.granted) return;

    const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!isValidExpoPushToken(pushToken)) {
      console.warn('[Notifications] 유효하지 않은 Expo Push Token입니다.');
      return;
    }

    const cached = pushTokenCache.get(userId);
    if (cached === pushToken) return;

    const { error } = await supabase
      .from('user_profiles')
      .update({ push_token: pushToken })
      .eq('id', userId);

    if (error) {
      console.warn('[Notifications] push_token 저장에 실패했습니다.', error);
      return;
    }

    pushTokenCache.set(userId, pushToken);
  } catch (error) {
    console.warn('[Notifications] Push Token 등록에 실패했습니다.', error);
  }
}

export async function sendSharedFinancePushOnCreate(tx: Transaction): Promise<void> {
  try {
    const recipients = await getSharedFinanceRecipients(tx.user_id);
    const validTokens = recipients
      .map((recipient) => recipient.push_token)
      .filter((token): token is string => isValidExpoPushToken(token));

    if (validTokens.length === 0) return;

    const actorName = tx.user_id ? await getDisplayName(tx.user_id) : null;
    const actor = actorName ?? '공유 멤버';
    const label = getTransactionTypeLabel(tx.type);
    const amount = getNotificationAmount(tx);
    const description = tx.description?.trim() || '내역 없음';
    const title = '공유 가계부 업데이트';
    const body = `${actor}님이 ${label} ${amount} (${description})을(를) 추가했어요.`;

    const payload = validTokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: {
        type: 'shared_finance_transaction',
        transaction_id: tx.id,
      },
    }));

    const response = await fetch(EXPO_PUSH_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.warn('[Notifications] Expo Push API 전송 실패', response.status, text);
    }
  } catch (error) {
    console.warn('[Notifications] 공유 가계부 푸시 전송 실패', error);
  }
}

export async function notifySharedTransactionAdded(tx: Transaction): Promise<void> {
  try {
    const actorName = tx.user_id ? await getDisplayName(tx.user_id) : null;
    const actor = actorName ?? '공유 멤버';
    const label = getTransactionTypeLabel(tx.type);
    const amount = getNotificationAmount(tx);
    const description = tx.description?.trim() || '내역 없음';
    const title = '공유 가계부 업데이트';
    const body = `${actor}님이 ${label} ${amount} (${description})을(를) 추가했어요.`;

    const Notifications = await getNotificationsModule();
    if (!Notifications) {
      showInAppFallbackNotification(title, body);
      return;
    }

    await initNotifications();
    await ensureNotificationPermissions();

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: Platform.OS === 'android' ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn('[Notifications] 공유 거래 알림 표시 중 오류가 발생했습니다.', error);
    const fallbackTitle = '공유 가계부 업데이트';
    const fallbackBody = '공유 거래가 추가되었습니다.';
    showInAppFallbackNotification(fallbackTitle, fallbackBody);
  }
}
