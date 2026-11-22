import Svg, { Circle, Path } from 'react-native-svg';
import { colors } from '../theme/colors';

export type IconName =
  | 'back'
  | 'chevron'
  | 'check'
  | 'home'
  | 'grip'
  | 'close'
  | 'bell';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export default function Icon({
  name,
  size = 20,
  color = colors.ink,
  strokeWidth = 2,
}: Props) {
  const stroke = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {name === 'back' && <Path d="M15 18l-6-6 6-6" {...stroke} />}
      {name === 'chevron' && <Path d="M9 18l6-6-6-6" {...stroke} />}
      {name === 'check' && <Path d="M20 6 9 17l-5-5" {...stroke} />}
      {name === 'close' && <Path d="M18 6 6 18M6 6l12 12" {...stroke} />}
      {name === 'home' && (
        <>
          <Path d="M3 10.5 12 3l9 7.5" {...stroke} />
          <Path d="M5 9.5V21h14V9.5" {...stroke} />
        </>
      )}
      {name === 'bell' && (
        <>
          <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" {...stroke} />
          <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" {...stroke} />
        </>
      )}
      {name === 'grip' &&
        [6, 12, 18].flatMap(y =>
          [9, 15].map(x => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill={color} />
          )),
        )}
    </Svg>
  );
}
