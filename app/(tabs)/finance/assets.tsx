import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Alert, Modal, TextInput, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAssetStore } from '../../../src/stores/asset.store';
import { useAuthStore } from '../../../src/stores/auth.store';
import { Asset, AssetType, CreateAssetDto } from '../../../src/types';
import { formatCurrency } from '../../../src/utils/currency';
import { ASSET_TYPE_LABELS } from '../../../src/utils/constants';

const ASSET_TYPES: AssetType[] = ['bank_account', 'credit_card', 'cash', 'investment', 'loan'];
const ASSET_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#EF4444', '#6B7280'];

export default function AssetsScreen() {
  const { user } = useAuthStore();
  const { assets, fetchAssets, addAsset, deleteAsset, totalBalance, ownBalance } = useAssetStore();
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName]     = useState('');
  const [newType, setNewType]     = useState<AssetType>('bank_account');
  const [newBalance, setBalance]  = useState('');
  const [newColor, setNewColor]   = useState(ASSET_COLORS[0]);
  const [isSaving, setSaving]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadAssets = useCallback(async () => {
    if (!user) return;
    try {
      await fetchAssets(user.id);
    } catch (error) {
      console.warn('[AssetsScreen] 자산 조회에 실패했습니다.', error);
    }
  }, [user, fetchAssets]);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAssets();
    setRefreshing(false);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert('입력 오류', '자산 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const initialBal = parseInt(newBalance.replace(/[^0-9]/g, ''), 10) || 0;
      const dto: CreateAssetDto = {
        user_id: user!.id,
        name: newName.trim(),
        type: newType,
        initial_balance: initialBal,
        current_balance: initialBal,
        color: newColor,
      };
      await addAsset(dto);
      setShowModal(false);
      setNewName('');
      setBalance('');
    } catch (e: any) {
      Alert.alert('오류', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (asset: Asset) => {
    Alert.alert('자산 삭제', `"${asset.name}"을(를) 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAsset(asset.id);
          } catch (e: any) {
            Alert.alert('삭제 실패', e?.message ?? '자산 삭제에 실패했습니다.');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-black">
      {/* 헤더 */}
      <View className="flex-row items-center px-5 py-4">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-2xl text-text-primary dark:text-text-dark-primary">←</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-xl font-bold text-text-primary dark:text-text-dark-primary">
          자산 관리
        </Text>
        <TouchableOpacity
          className="bg-primary px-4 py-2 rounded-full"
          onPress={() => setShowModal(true)}
        >
          <Text className="text-white text-sm font-semibold">+ 추가</Text>
        </TouchableOpacity>
      </View>

      {/* 총 자산 */}
      <View className="mx-5 mb-4 bg-primary rounded-2xl p-4">
        <View className="flex-row items-end justify-between">
          <View className="flex-1">
            <Text className="text-white/80 text-sm">총 자산 (공유 포함)</Text>
            <Text className="text-white text-2xl font-bold mt-1">
              {formatCurrency(totalBalance)}
            </Text>
          </View>
          <View className="items-end ml-4">
            <Text className="text-white/70 text-xs">개인 자산</Text>
            <Text className="text-white text-lg font-semibold mt-1">
              {formatCurrency(ownBalance)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5"
        contentContainerStyle={{ paddingBottom: 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {assets.length === 0 ? (
          <View className="items-center py-10">
            <Text className="text-5xl mb-4">🏦</Text>
            <Text className="text-text-secondary">자산을 추가해 주세요</Text>
          </View>
        ) : (
          assets.map((asset) => (
            <TouchableOpacity
              key={asset.id}
              className="flex-row items-center bg-white dark:bg-surface-dark rounded-2xl p-4 mb-3"
              onLongPress={() => handleDelete(asset)}
              activeOpacity={0.8}
            >
              <View
                className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                style={{ backgroundColor: asset.color + '20' }}
              >
                <Text className="text-2xl">
                  {asset.type === 'cash' ? '💵' :
                   asset.type === 'credit_card' ? '💳' :
                   asset.type === 'investment' ? '📈' :
                   asset.type === 'loan' ? '🏦' : '🏛️'}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-text-primary dark:text-text-dark-primary">
                  {asset.name}
                </Text>
                <Text className="text-xs text-text-secondary mt-0.5">
                  {ASSET_TYPE_LABELS[asset.type]}
                  {asset.institution ? ` · ${asset.institution}` : ''}
                </Text>
              </View>
              <Text className="text-base font-bold" style={{ color: asset.color }}>
                {formatCurrency(asset.current_balance)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 자산 추가 모달 */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white dark:bg-surface-dark rounded-t-3xl p-6">
            <Text className="text-xl font-bold text-text-primary dark:text-text-dark-primary mb-5">
              자산 추가
            </Text>

            <Text className="text-xs font-medium text-text-secondary mb-2">이름</Text>
            <TextInput
              className="border border-border dark:border-border-dark rounded-xl px-4 py-3 text-base text-text-primary dark:text-text-dark-primary mb-4"
              placeholder="예: 카카오뱅크"
              placeholderTextColor="#9CA3AF"
              value={newName}
              onChangeText={setNewName}
            />

            <Text className="text-xs font-medium text-text-secondary mb-2">종류</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-x-2">
                {ASSET_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    className={`px-3 py-2 rounded-xl border ${
                      newType === type ? 'bg-primary border-primary' : 'border-border'
                    }`}
                    onPress={() => setNewType(type)}
                  >
                    <Text className={`text-xs ${newType === type ? 'text-white font-medium' : 'text-text-secondary'}`}>
                      {ASSET_TYPE_LABELS[type]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text className="text-xs font-medium text-text-secondary mb-2">초기 잔액</Text>
            <TextInput
              className="border border-border dark:border-border-dark rounded-xl px-4 py-3 text-base text-text-primary dark:text-text-dark-primary mb-4"
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={newBalance}
              onChangeText={setBalance}
            />

            <Text className="text-xs font-medium text-text-secondary mb-2">색상</Text>
            <View className="flex-row gap-x-3 mb-6">
              {ASSET_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  className={`w-8 h-8 rounded-full ${newColor === color ? 'border-2 border-gray-800 dark:border-white' : ''}`}
                  style={{ backgroundColor: color }}
                  onPress={() => setNewColor(color)}
                />
              ))}
            </View>

            <View className="flex-row gap-x-3">
              <TouchableOpacity
                className="flex-1 border border-border py-4 rounded-2xl items-center"
                onPress={() => setShowModal(false)}
              >
                <Text className="text-text-primary font-semibold">취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-4 rounded-2xl items-center ${isSaving ? 'bg-primary/60' : 'bg-primary'}`}
                onPress={handleAdd}
                disabled={isSaving}
              >
                <Text className="text-white font-semibold">{isSaving ? '저장 중...' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
