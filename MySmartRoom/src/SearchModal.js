// src/components/SearchModal.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, Modal, TouchableOpacity, StyleSheet, Button
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function SearchModal({ visible, onClose, onApply }) {
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('all'); // all | sensor | fan | light (UI display)
  const [status, setStatus] = useState('all'); // all | on | off | detected | none
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const resetAll = () => {
    setKeyword('');
    setType('all');
    setStatus('all');
    setStartDate(null);
    setEndDate(null);
  };

  const applyFilter = () => {
    let mappedType = type;
    if (type === 'fan') mappedType = 'minifan';
    else if (type === 'light') mappedType = 'rgb_led';
    else if (type === 'sensor') mappedType = 'sensor'; // giữ nguyên
    else if (type === 'all') mappedType = 'all'; // giữ nguyên

    onApply({
      keyword: keyword.trim(),
      type: mappedType,
      status,
      startDate,
      endDate
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={styles.content}>
          <Text style={styles.title}>Search / Filter Logs</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter keyword (e.g., Fan, Light, 30°C)"
            value={keyword}
            onChangeText={setKeyword}
          />

          <Text style={styles.label}>Type:</Text>
          <View style={styles.row}>
            {['all', 'sensor', 'fan', 'light'].map(opt => (
              <TouchableOpacity key={opt} onPress={() => setType(opt)} style={[styles.typeBtn, type === opt && styles.selectedBtn]}>
                <Text style={type === opt ? styles.selectedText : styles.normalText}>
                  {opt === 'fan' ? 'FAN' : opt === 'light' ? 'LIGHT' : opt.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Status:</Text>
          <View style={styles.row}>
            {['all', 'on', 'off', 'detected', 'none'].map(opt => (
              <TouchableOpacity key={opt} onPress={() => setStatus(opt)} style={[styles.typeBtn, status === opt && styles.selectedBtn]}>
                <Text style={status === opt ? styles.selectedText : styles.normalText}>{opt.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginTop: 10 }}>
            <Button title="Select Start Date" onPress={() => setShowStartPicker(true)} />
            {startDate && <Text style={styles.dateText}>From: {startDate.toDateString()}</Text>}
          </View>

          <View style={{ marginTop: 10 }}>
            <Button title="Select End Date" onPress={() => setShowEndPicker(true)} />
            {endDate && <Text style={styles.dateText}>To: {endDate.toDateString()}</Text>}
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate || new Date()}
              mode="date"
              display="default"
              onChange={(e, date) => {
                setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate || new Date()}
              mode="date"
              display="default"
              onChange={(e, date) => {
                setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={resetAll} style={styles.cancelBtn}>
              <Text style={{ color: '#e74c3c', fontWeight: '600' }}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={applyFilter} style={styles.applyBtn}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Apply</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: 'white', padding: 20, borderRadius: 10, width: '90%' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, marginVertical: 10 },
  label: { marginTop: 10, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  typeBtn: { padding: 8, borderWidth: 1, borderRadius: 6, margin: 5 },
  selectedBtn: { backgroundColor: '#50C2C9' },
  normalText: { color: '#333' },
  selectedText: { color: 'white' },
  dateText: { marginTop: 5, fontSize: 13 },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  cancelBtn: { padding: 10 },
  applyBtn: { backgroundColor: '#50C2C9', padding: 10, borderRadius: 6 },
});
