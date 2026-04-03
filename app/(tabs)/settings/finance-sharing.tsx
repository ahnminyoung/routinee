import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../../src/stores/auth.store';
import {
  collabService,
  FinanceConnectionMember,
} from '../../../src/services/collab.service';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function FinanceSharingScreen() {
  const { user } = useAuthStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [members, setMembers] = useState<FinanceConnectionMember[]>([]);

  const loadMembers = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await collabService.fetchFinanceConnections(user.id);
      setMembers(data);
    } catch (e: any) {
      Alert.alert('조회 실패', e?.message ?? '공유 멤버를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMembers();
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!user) return;
    const normalized = inviteEmail.trim().toLowerCase();
    if (!normalized) {
      Alert.alert('입력 오류', '초대할 이메일을 입력해주세요.');
      return;
    }
    if (!EMAIL_REGEX.test(normalized)) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }
    setInviting(true);
    try {
      await collabService.connectByEmail(user.id, normalized);
      setInviteEmail('');
      await loadMembers();
      Alert.alert('연결 완료', '가계부 공유 멤버로 연결되었습니다.');
    } catch (e: any) {
      Alert.alert('연결 실패', e?.message ?? '멤버 연결에 실패했습니다.');
    } finally {
      setInviting(false);
    }
  };

  const handleToggleShare = async (member: FinanceConnectionMember, enabled: boolean) => {
    setMembers((prev) => prev.map((m) => (
      m.connection_id === member.connection_id ? { ...m, share_finance: enabled } : m
    )));
    try {
      await collabService.setFinanceShareEnabled(member.connection_id, enabled);
    } catch (e: any) {
      setMembers((prev) => prev.map((m) => (
        m.connection_id === member.connection_id ? { ...m, share_finance: !enabled } : m
      )));
      Alert.alert('변경 실패', e?.message ?? '가계부 공유 설정 변경에 실패했습니다.');
    }
  };

  const outgoing = useMemo(
    () => members.filter((m) => m.direction === 'outgoing'),
    [members]
  );
  const incoming = useMemo(
    () => members.filter((m) => m.direction === 'incoming'),
    [members]
  );
  const sharedCount = members.filter((m) => m.share_finance).length;

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          가계부 공유
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View className="bg-primary rounded-2xl p-4 mb-4">
          <Text className="text-white/90 text-sm">현재 공유 상태</Text>
          <Text className="text-white text-2xl font-bold mt-1">
            {sharedCount}명과 공유 중
          </Text>
          <Text className="text-white/80 text-xs mt-2">
            상대도 같은 달 지출/수입 합계를 함께 보게 됩니다.
          </Text>
        </View>

        <View className="bg-white dark:bg-surface-dark rounded-2xl p-4 mb-4">
          <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary mb-2">
            멤버 초대(이메일)
          </Text>
          <View className="flex-row items-center">
            <TextInput
              className="flex-1 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="wife@example.com"
              placeholderTextColor="#9CA3AF"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TouchableOpacity
              className={`ml-2 px-4 py-2 rounded-xl ${inviting ? 'bg-primary/60' : 'bg-primary'}`}
              disabled={inviting}
              onPress={handleInvite}
            >
              <Text className="text-white font-semibold text-sm">
                {inviting ? '초대 중' : '초대'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <ConnectionSection
          title="내가 연결한 멤버"
          subtitle="내가 초대/연결한 사람"
          members={outgoing}
          loading={loading}
          onToggle={handleToggleShare}
        />

        <ConnectionSection
          title="나를 연결한 멤버"
          subtitle="상대가 먼저 연결한 사람"
          members={incoming}
          loading={loading}
          onToggle={handleToggleShare}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function ConnectionSection({
  title,
  subtitle,
  members,
  loading,
  onToggle,
}: {
  title: string;
  subtitle: string;
  members: FinanceConnectionMember[];
  loading: boolean;
  onToggle: (member: FinanceConnectionMember, enabled: boolean) => void;
}) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-medium text-text-secondary mb-2 px-1">{title}</Text>
      <View className="bg-white dark:bg-surface-dark rounded-2xl overflow-hidden">
        <View className="px-4 py-3 border-b border-border dark:border-border-dark">
          <Text className="text-xs text-text-secondary">{subtitle}</Text>
        </View>

        {loading ? (
          <View className="px-4 py-4">
            <Text className="text-sm text-text-secondary">불러오는 중...</Text>
          </View>
        ) : members.length === 0 ? (
          <View className="px-4 py-4">
            <Text className="text-sm text-text-secondary">연결된 멤버가 없습니다.</Text>
          </View>
        ) : (
          members.map((member, index) => (
            <View
              key={member.connection_id}
              className={`flex-row items-center px-4 py-3 ${
                index < members.length - 1 ? 'border-b border-border dark:border-border-dark' : ''
              }`}
            >
              <View className="flex-1 pr-3">
                <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                  {member.display_name ?? member.email}
                </Text>
                <Text className="text-xs text-text-secondary mt-0.5">{member.email}</Text>
                <Text className={`text-xs mt-1 ${member.share_finance ? 'text-primary' : 'text-text-secondary'}`}>
                  {member.share_finance ? '가계부 공유 중' : '가계부 공유 중지'}
                </Text>
              </View>
              <Switch
                value={member.share_finance}
                onValueChange={(next) => onToggle(member, next)}
              />
            </View>
          ))
        )}
      </View>
    </View>
  );
}
