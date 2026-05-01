import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { encountersApi } from '../../../../services/socialApi';

const AutoSuggestInput = ({ value, onChangeText, onSelect, currentLat, currentLon }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef(null);

  const fetchSuggestions = useCallback(
    async (text) => {
      if (!text || text.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }

      const results = [];

      // Fetch backend suggestions
      try {
        if (currentLat && currentLon) {
          const apiResult = await encountersApi.suggestLocations(
            currentLat,
            currentLon,
          );
          if (apiResult && Array.isArray(apiResult.suggestions)) {
            apiResult.suggestions.forEach((s) => {
              results.push({
                name: s.name || s.location_name,
                lat: s.lat,
                lon: s.lon,
                source: 'api',
              });
            });
          }
        }
      } catch (e) {
        // Silently fail for API suggestions
      }

      // Fetch Nominatim suggestions
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
            text,
          )}&format=json&limit=5`,
          {
            headers: {
              'User-Agent': 'HevolveApp/1.0',
            },
          },
        );
        const nominatimResults = await response.json();
        if (Array.isArray(nominatimResults)) {
          nominatimResults.forEach((item) => {
            results.push({
              name: item.display_name,
              lat: item.lat,
              lon: item.lon,
              source: 'nominatim',
            });
          });
        }
      } catch (e) {
        // Silently fail for Nominatim
      }

      // Deduplicate by name (case-insensitive)
      const seen = new Set();
      const unique = [];
      results.forEach((r) => {
        const key = r.name.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(r);
        }
      });

      setSuggestions(unique);
      setShowDropdown(unique.length > 0);
    },
    [currentLat, currentLon],
  );

  const handleTextChange = useCallback(
    (text) => {
      onChangeText(text);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(text);
      }, 300);
    },
    [onChangeText, fetchSuggestions],
  );

  const handleSelect = useCallback(
    (item) => {
      onSelect({ name: item.name, lat: item.lat, lon: item.lon });
      setShowDropdown(false);
      setSuggestions([]);
    },
    [onSelect],
  );

  const renderSuggestion = ({ item }) => (
    <TouchableOpacity
      style={styles.suggestionItem}
      onPress={() => handleSelect(item)}
    >
      <MaterialIcons name="location-on" size={18} color="#00e89d" />
      <Text style={styles.suggestionText} numberOfLines={1}>
        {item.name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={handleTextChange}
        placeholder="Search for a location..."
        placeholderTextColor="#666"
        onFocus={() => {
          if (suggestions.length > 0) setShowDropdown(true);
        }}
        onBlur={() => {
          // Delay to allow tap on suggestion
          setTimeout(() => setShowDropdown(false), 200);
        }}
      />
      {showDropdown && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.name}-${index}`}
            renderItem={renderSuggestion}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  input: {
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    padding: wp('3.5%'),
    color: '#FFF',
    fontSize: wp('3.5%'),
    borderWidth: 1,
    borderColor: '#3a3a4e',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#2a2a3e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3a3a4e',
    maxHeight: 200,
    zIndex: 20,
    elevation: 10,
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.2%'),
    borderBottomWidth: 0.5,
    borderBottomColor: '#3a3a4e',
  },
  suggestionText: {
    color: '#DDD',
    fontSize: wp('3.2%'),
    marginLeft: 8,
    flex: 1,
  },
});

export default AutoSuggestInput;
