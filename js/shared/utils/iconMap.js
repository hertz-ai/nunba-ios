import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';

/**
 * Map from icon type string to vector icon component.
 */
const ICON_MAP = {
  material: MaterialIcons,
  community: MaterialCommunityIcons,
  ion: Ionicons,
};

export default ICON_MAP;
