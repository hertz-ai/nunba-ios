import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';

const reportReasons = [
  'Harassment',
  'Fraud or scam',
  'Spam',
  'Misinformation',
  'Hateful speech',
  'Threats or violence',
  'Self-harm',
  'Graphic content',
  'Dangerous or extremist organizations',
  'Sexual content',
  'Fake account',
  'Hacked account',
  'Child exploitation',
  'Illegal goods and services',
  'Infringement',
];

const ReportModal = ({ navigation, route  }) => {
  const [selectedReason, setSelectedReason] = useState(null);
  const { post_id, deletePost  } = route.params;

  const handleReport = () => {
    if (selectedReason) {
      console.log('Reporting post:', post_id, 'Reason:', selectedReason);
      deletePost(post_id, selectedReason);
      navigation.goBack(); // Navigate back after reporting
    } else {
      Alert.alert('Error', 'Please select a reason for reporting.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Report this post</Text>
      <Text style={styles.subtitle}>Select a reason that applies</Text>
      <ScrollView contentContainerStyle={styles.reasonsContainer}>
        {reportReasons.map((reason, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.reasonButton,
              selectedReason === reason && styles.selectedReasonButton,
            ]}
            onPress={() => setSelectedReason(reason)}
          >
            <Text
              style={[
                styles.reasonText,
                selectedReason === reason && styles.selectedReasonText,
              ]}
            >
              {reason}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <TouchableOpacity style={styles.submitButton} onPress={handleReport}>
        <Text style={styles.submitButtonText}>Submit</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1C1C1E',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#AAAAAA',
    marginBottom: 20,
  },
  reasonsContainer: {
    flexWrap: 'wrap',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  reasonButton: {
    borderWidth: 1,
    borderColor: '#444444',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    margin: 5,
    alignItems: 'center',
  },
  selectedReasonButton: {
    backgroundColor: '#2C2C2E',
  },
  reasonText: {
    fontSize: 14,
    color: '#DDDDDD',
  },
  selectedReasonText: {
    color: '#007BFF',
  },
  submitButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#007BFF',
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
  },
});

export default ReportModal;
