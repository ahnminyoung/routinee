// 앱 화면/라우팅 로직: app/modals/add-todo.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/auth.store';
import { useTodoStore } from '../../src/stores/todo.store';
import { useCategoryStore } from '../../src/stores/category.store';
import { CreateTodoDto } from '../../src/types';
import { today } from '../../src/utils/date';
import { collabService, ConnectedMember } from '../../src/services/collab.service';
import { todoParticipantService } from '../../src/services/todo-participant.service';
import { offlineQueueService } from '../../src/services/offline-queue.service';

const LABEL_THEMES = [
  { name: '에메랄드 그린', color: '#10B981' },
  { name: '둘이 같이 스케줄', color: '#14B8A6' },
  { name: '병원', color: '#3B82F6' },
  { name: '파스텔 브라운', color: '#8B7E74' },
  { name: '미드나잇 블랙', color: '#6B7280' },
  { name: '애플 레드', color: '#DC2626' },
  { name: '프렌치 로즈', color: '#EC4899' },
  { name: '데이트', color: '#CD6A6A' },
  { name: '휴가', color: '#D4A72C' },
  { name: '각자 스케줄', color: '#8B5CF6' },
] as const;
const REMINDER_OPTIONS = [0, 10, 30, 60, 180, 1440];

const buildDateTimeIso = (date: string, time: string): string | null => {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export default function AddTodoModal() {
  const { user } = useAuthStore();
  const { addTodo, selectedDate } = useTodoStore();
  const { getCategoriesByType } = useCategoryStore();

  const [title, setTitle] = useState('');
  const [description, setDesc] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState(selectedDate || today());
  const [isSaving, setSaving] = useState(false);

  const [isAllDay, setIsAllDay] = useState(true);
  const [startDate, setStartDate] = useState(selectedDate || today());
  const [startTime, setStartTime] = useState('09:00');
  const [endDate, setEndDate] = useState(selectedDate || today());
  const [endTime, setEndTime] = useState('10:00');
  const [isLunar, setIsLunar] = useState(false);
  const [saveAsMemo, setSaveAsMemo] = useState(false);
  const [isAnniversary, setIsAnniversary] = useState(false);
  const [selectedLabelTheme, setSelectedLabelTheme] = useState<(typeof LABEL_THEMES)[number]>(LABEL_THEMES[0]);
  const [showLabelThemeModal, setShowLabelThemeModal] = useState(false);
  const [reminderMinutes, setReminderMinutes] = useState(10);

  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatRule, setRepeatRule] = useState('');
  const [dDayEnabled, setDDayEnabled] = useState(false);
  const [location, setLocation] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [checklistText, setChecklistText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const [showParticipantsModal, setShowParticipantsModal] = useState(false);
  const [connectedMembers, setConnectedMembers] = useState<ConnectedMember[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setInviting] = useState(false);
  const [isLoadingMembers, setLoadingMembers] = useState(false);

  const todoCategories = getCategoriesByType('todo');

  const loadMembers = useCallback(async () => {
    if (!user) return;
    setLoadingMembers(true);
    try {
      const members = await collabService.fetchMembers(user.id);
      setConnectedMembers(members);
    } catch (e: any) {
      Alert.alert('연결 멤버 조회 실패', e?.message ?? '멤버 정보를 불러오지 못했습니다.');
    } finally {
      setLoadingMembers(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const selectedMembers = useMemo(() => {
    const selectedSet = new Set(selectedParticipantIds);
    return connectedMembers.filter((m) => selectedSet.has(m.id));
  }, [connectedMembers, selectedParticipantIds]);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setDueDate(value);
  };

  const toggleParticipant = (id: string) => {
    setSelectedParticipantIds((prev) => (
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    ));
  };

  const handleInvite = async () => {
    if (!user) return;
    const normalized = inviteEmail.trim().toLowerCase();
    if (!normalized) {
      Alert.alert('입력 오류', '초대할 이메일을 입력해주세요.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      Alert.alert('입력 오류', '올바른 이메일 형식을 입력해주세요.');
      return;
    }

    setInviting(true);
    try {
      const member = await collabService.connectByEmail(user.id, normalized);
      setInviteEmail('');
      await loadMembers();
      setSelectedParticipantIds((prev) => (
        prev.includes(member.id) ? prev : [...prev, member.id]
      ));
      Alert.alert('연결 완료', `${member.display_name ?? member.email}님과 연결되었습니다.`);
    } catch (e: any) {
      Alert.alert('초대 실패', e?.message ?? '연결 초대에 실패했습니다.');
    } finally {
      setInviting(false);
    }
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      Alert.alert('입력 오류', '제목을 입력해주세요.');
      return;
    }
    if (!user) return;

    const checklistItems = checklistText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((text) => ({ text, done: false }));

    const startAt = isAllDay ? buildDateTimeIso(startDate, '00:00') : buildDateTimeIso(startDate, startTime);
    const endAt = isAllDay ? buildDateTimeIso(endDate, '23:59') : buildDateTimeIso(endDate, endTime);

    setSaving(true);
    try {
      const dto: CreateTodoDto = {
        user_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        category_id: categoryId,
        due_date: dueDate,
        due_time: isAllDay ? null : startTime,
        status: 'pending',
        is_all_day: isAllDay,
        start_at: startAt,
        end_at: endAt,
        is_lunar: isLunar,
        save_as_memo: saveAsMemo,
        is_anniversary: isAnniversary,
        label_color: selectedLabelTheme.color,
        reminder_minutes: reminderMinutes,
        is_recurring: repeatEnabled,
        recurrence_rule: repeatEnabled ? (repeatRule.trim() || 'FREQ=DAILY') : null,
        d_day_enabled: dDayEnabled,
        location: location.trim() || null,
        link_url: linkUrl.trim() || null,
        memo: memo.trim() || null,
        checklist_json: checklistItems,
        attachment_url: attachmentUrl.trim() || null,
      };

      const created = await addTodo(dto);
      // 오프라인 임시 ID(local-*)는 서버에 아직 없는 레코드이므로 참여자 저장을 스킵합니다.
      if (!created.id.startsWith('local-')) {
        // 온라인 생성: 즉시 참여자 테이블을 서버에 반영합니다.
        await todoParticipantService.replaceParticipants(
          created.id,
          user.id,
          selectedParticipantIds
        );
      } else if (selectedParticipantIds.length > 0) {
        // 오프라인 생성 건은 큐 메타에 참여자 정보를 저장해, 온라인 동기화 시 복원합니다.
        await offlineQueueService.updateCreateMeta(user.id, 'todo', created.id, {
          // 동기화 시 참여자 저장 API 호출을 위해 소유자/참여자 정보를 함께 보관합니다.
          owner_id: user.id,
          participant_ids: selectedParticipantIds,
        });
      }
      router.back();
    } catch (e: any) {
      Alert.alert('저장 실패', e?.message ?? '할일 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="items-center pt-3 pb-1">
          <View className="w-10 h-1 bg-border dark:bg-border-dark rounded-full" />
        </View>
        <View className="flex-row items-center px-5 py-3">
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-primary">취소</Text>
          </TouchableOpacity>
          <Text className="flex-1 text-center text-lg font-bold text-text-primary dark:text-text-dark-primary">
            할일 추가
          </Text>
          <TouchableOpacity onPress={handleAdd} disabled={isSaving}>
            <Text className={`font-semibold ${isSaving ? 'text-primary/50' : 'text-primary'}`}>
              {isSaving ? '저장 중' : '저장'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            className="text-2xl font-bold text-text-primary dark:text-text-dark-primary py-4 border-b border-border dark:border-border-dark"
            placeholder="제목"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            autoFocus
          />

          <View className="py-4 border-b border-border dark:border-border-dark">
            <RowLabel label="종일" />
            <Switch value={isAllDay} onValueChange={setIsAllDay} />
          </View>

          <View className="py-4 border-b border-border dark:border-border-dark">
            <RowLabel label="시작" />
            <View className="flex-row gap-x-2 mt-2">
              <InlineInput value={startDate} onChangeText={handleStartDateChange} placeholder="YYYY-MM-DD" />
              {!isAllDay && (
                <InlineInput value={startTime} onChangeText={setStartTime} placeholder="HH:mm" />
              )}
            </View>
          </View>

          <View className="py-4 border-b border-border dark:border-border-dark">
            <RowLabel label="종료" />
            <View className="flex-row gap-x-2 mt-2">
              <InlineInput value={endDate} onChangeText={setEndDate} placeholder="YYYY-MM-DD" />
              {!isAllDay && (
                <InlineInput value={endTime} onChangeText={setEndTime} placeholder="HH:mm" />
              )}
            </View>
          </View>

          <SwitchRow label="음력" value={isLunar} onChange={setIsLunar} />
          <SwitchRow label="메모로 저장하기" value={saveAsMemo} onChange={setSaveAsMemo} />
          <SwitchRow label="연인" value={isAnniversary} onChange={setIsAnniversary} />

          <View className="py-4 border-b border-border dark:border-border-dark">
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => setShowLabelThemeModal(true)}
            >
              <RowLabel label="라벨 테마" />
              <View className="flex-row items-center">
                <View
                  className="w-3 h-6 rounded-full mr-2"
                  style={{ backgroundColor: selectedLabelTheme.color }}
                />
                <Text className="text-sm text-text-secondary">{selectedLabelTheme.name}</Text>
                <Text className="text-text-secondary ml-2">›</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View className="py-4 border-b border-border dark:border-border-dark">
            <TouchableOpacity
              className="flex-row items-center justify-between"
              onPress={() => setShowParticipantsModal(true)}
            >
              <RowLabel label="참여자" />
              <Text className="text-text-secondary text-xs">
                {selectedMembers.length > 0 ? `${selectedMembers.length}명 선택` : '선택'}
              </Text>
            </TouchableOpacity>
            {selectedMembers.length > 0 && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                {selectedMembers.map((member) => (
                  <View key={member.id} className="px-2.5 py-1 rounded-full bg-primary/20">
                    <Text className="text-xs text-primary">
                      {member.display_name ?? member.email}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="py-4 border-b border-border dark:border-border-dark">
            <RowLabel label="알림" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
              <View className="flex-row gap-x-2">
                {REMINDER_OPTIONS.map((minutes) => (
                  <TouchableOpacity
                    key={minutes}
                    className={`px-3 py-1.5 rounded-full border ${
                      reminderMinutes === minutes
                        ? 'bg-primary border-primary'
                        : 'border-border dark:border-border-dark'
                    }`}
                    onPress={() => setReminderMinutes(minutes)}
                  >
                    <Text className={`text-xs ${reminderMinutes === minutes ? 'text-white' : 'text-text-secondary'}`}>
                      {minutes === 0 ? '정시' : `${minutes}분 전`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {todoCategories.length > 0 && (
            <View className="py-4 border-b border-border dark:border-border-dark">
              <Text className="text-xs font-medium text-text-secondary mb-3">카테고리</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-x-2">
                  <TouchableOpacity
                    className={`px-3 py-1.5 rounded-full border ${
                      categoryId === null ? 'bg-primary border-primary' : 'border-border'
                    }`}
                    onPress={() => setCategoryId(null)}
                  >
                    <Text className={`text-xs ${categoryId === null ? 'text-white' : 'text-text-secondary'}`}>
                      없음
                    </Text>
                  </TouchableOpacity>
                  {todoCategories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      className={`px-3 py-1.5 rounded-full border ${
                        categoryId === cat.id ? 'border-transparent' : 'border-border'
                      }`}
                      style={categoryId === cat.id ? { backgroundColor: cat.color } : {}}
                      onPress={() => setCategoryId(cat.id)}
                    >
                      <Text
                        style={{ fontSize: 12 }}
                        className={categoryId === cat.id ? 'text-white font-medium' : 'text-text-secondary'}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          <View className="py-4">
            <Text className="text-xs font-medium text-text-secondary mb-3">추가 기능</Text>
            <View className="flex-row flex-wrap gap-2">
              <FeatureChip
                active={repeatEnabled}
                label="반복"
                onPress={() => setRepeatEnabled((v) => !v)}
              />
              <FeatureChip
                active={dDayEnabled}
                label="D-Day"
                onPress={() => setDDayEnabled((v) => !v)}
              />
            </View>
            {repeatEnabled && (
              <TextInput
                className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
                placeholder="반복 규칙 (예: FREQ=WEEKLY;BYDAY=MO)"
                placeholderTextColor="#9CA3AF"
                value={repeatRule}
                onChangeText={setRepeatRule}
              />
            )}

            <TextInput
              className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="위치"
              placeholderTextColor="#9CA3AF"
              value={location}
              onChangeText={setLocation}
            />
            <TextInput
              className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="링크 URL"
              placeholderTextColor="#9CA3AF"
              value={linkUrl}
              onChangeText={setLinkUrl}
              autoCapitalize="none"
            />
            <TextInput
              className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="메모"
              placeholderTextColor="#9CA3AF"
              value={memo}
              onChangeText={setMemo}
              multiline
            />
            <TextInput
              className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="To-Do 리스트 (한 줄에 하나씩)"
              placeholderTextColor="#9CA3AF"
              value={checklistText}
              onChangeText={setChecklistText}
              multiline
            />
            <TextInput
              className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="첨부 파일 URL"
              placeholderTextColor="#9CA3AF"
              value={attachmentUrl}
              onChangeText={setAttachmentUrl}
              autoCapitalize="none"
            />
            <TextInput
              className="mt-3 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
              placeholder="상세 설명"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDesc}
              multiline
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showParticipantsModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-surface-dark rounded-t-3xl p-5 pb-8 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
                참여자 선택
              </Text>
              <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
                <Text className="text-primary font-semibold">완료</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row gap-x-2 mb-3">
              <TextInput
                className="flex-1 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
                placeholder="이메일로 초대"
                placeholderTextColor="#9CA3AF"
                value={inviteEmail}
                onChangeText={setInviteEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <TouchableOpacity
                className={`px-4 py-2 rounded-xl ${isInviting ? 'bg-primary/60' : 'bg-primary'}`}
                onPress={handleInvite}
                disabled={isInviting}
              >
                <Text className="text-white text-sm font-semibold">
                  {isInviting ? '초대 중' : '초대'}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity className="mb-2" onPress={() => void loadMembers()}>
              <Text className="text-xs text-primary">멤버 새로고침</Text>
            </TouchableOpacity>

            <ScrollView className="max-h-96">
              <View className="py-2 border-b border-border dark:border-border-dark">
                <Text className="text-sm text-text-secondary">나</Text>
                <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary mt-1">
                  {user?.user_metadata?.full_name ?? user?.email ?? '나'}
                </Text>
              </View>

              {isLoadingMembers ? (
                <Text className="text-sm text-text-secondary mt-4">멤버를 불러오는 중...</Text>
              ) : connectedMembers.length === 0 ? (
                <Text className="text-sm text-text-secondary mt-4">
                  연결된 멤버가 없습니다. 이메일로 먼저 초대해주세요.
                </Text>
              ) : (
                connectedMembers.map((member) => {
                  const selected = selectedParticipantIds.includes(member.id);
                  return (
                    <TouchableOpacity
                      key={member.id}
                      className="flex-row items-center justify-between py-3 border-b border-border/60 dark:border-border-dark/60"
                      onPress={() => toggleParticipant(member.id)}
                    >
                      <View className="flex-1 pr-3">
                        <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
                          {member.display_name ?? member.email}
                        </Text>
                        <Text className="text-xs text-text-secondary mt-0.5">
                          {member.email}
                        </Text>
                      </View>
                      <View
                        className={`w-6 h-6 rounded-md border items-center justify-center ${
                          selected ? 'bg-primary border-primary' : 'border-border dark:border-border-dark'
                        }`}
                      >
                        {selected && <Text className="text-white text-xs">✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={showLabelThemeModal} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white dark:bg-surface-dark rounded-t-3xl p-5 pb-8 max-h-[78%]">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-text-primary dark:text-text-dark-primary">
                컬러 테마
              </Text>
              <TouchableOpacity onPress={() => setShowLabelThemeModal(false)}>
                <Text className="text-primary font-semibold">완료</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {LABEL_THEMES.map((theme, idx) => {
                const selected = selectedLabelTheme.color === theme.color;
                return (
                  <TouchableOpacity
                    key={theme.name}
                    className={`flex-row items-center py-4 ${idx < LABEL_THEMES.length - 1 ? 'border-b border-border dark:border-border-dark' : ''}`}
                    onPress={() => setSelectedLabelTheme(theme)}
                  >
                    <View className="w-3 h-8 rounded-full mr-4" style={{ backgroundColor: theme.color }} />
                    <Text className="flex-1 text-base font-semibold text-text-primary dark:text-text-dark-primary">
                      {theme.name}
                    </Text>
                    <View
                      className={`w-6 h-6 rounded-full border-2 items-center justify-center ${
                        selected ? 'border-primary' : 'border-text-secondary'
                      }`}
                    >
                      {selected ? <View className="w-2.5 h-2.5 rounded-full bg-primary" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function RowLabel({ label }: { label: string }) {
  return (
    <Text className="text-base font-semibold text-text-primary dark:text-text-dark-primary">
      {label}
    </Text>
  );
}

function SwitchRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="py-4 border-b border-border dark:border-border-dark flex-row items-center justify-between">
      <RowLabel label={label} />
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

function InlineInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      className="flex-1 border border-border dark:border-border-dark rounded-xl px-3 py-2 text-sm text-text-primary dark:text-text-dark-primary"
      placeholder={placeholder}
      placeholderTextColor="#9CA3AF"
      value={value}
      onChangeText={onChangeText}
    />
  );
}

function FeatureChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className={`px-3 py-1.5 rounded-full border ${active ? 'bg-primary border-primary' : 'border-border dark:border-border-dark'}`}
      onPress={onPress}
    >
      <Text className={`text-xs ${active ? 'text-white' : 'text-text-secondary'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
