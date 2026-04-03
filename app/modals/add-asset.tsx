import { router } from 'expo-router';
import { View } from 'react-native';
import AssetsScreen from '../(tabs)/finance/assets';

// 모달로 열릴 때 자산 추가 화면을 보여줍니다
export default function AddAssetModal() {
  return <AssetsScreen />;
}
