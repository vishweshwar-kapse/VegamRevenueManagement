import { Typography, Divider } from 'antd';
import { COLORS, FONT_SIZE } from '@/constants/theme';

const { Text } = Typography;

interface Props {
  children: React.ReactNode;
}

export default function SectionLabel({ children }: Props) {
  return (
    <>
      <Text
        strong
        style={{
          fontSize: FONT_SIZE.xs,
          color: COLORS.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {children}
      </Text>
      <Divider style={{ marginTop: 6, marginBottom: 14 }} />
    </>
  );
}
