import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

type Props = { onReady: () => void };
export default function LoadingScreen({ onReady }: Props) {
  const { width } = useWindowDimensions();
  const logoWidth = Math.min(width - 48, 330);
  const [logoReady, setLogoReady] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!logoReady) {
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    const timer = setTimeout(onReady, 1400);
    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [logoReady, onReady, progress]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brand}>
        <Image
          source={require('../../assets/images/leaseguard-logo.png')}
          accessibilityLabel="LeaseGuard"
          onLoadEnd={() => setLogoReady(true)}
          style={[
            styles.logo,
            { width: logoWidth, height: (logoWidth * 710) / 826 },
          ]}
          resizeMode="contain"
        />
        <View
          accessibilityRole="progressbar"
          accessibilityLabel="Loading LeaseGuard"
          style={styles.track}
        >
          <Animated.View
            style={[
              styles.progress,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brand: {
    backgroundColor: colors.background,
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 24,
    transform: [{ translateY: -80 }],
  },
  logo: {
    mixBlendMode: 'multiply',
  },
  track: {
    width: '70%',
    maxWidth: 244,
    height: 12,
    marginTop: 24,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progress: { height: '100%', backgroundColor: colors.progress },
});
