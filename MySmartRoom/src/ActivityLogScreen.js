import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SearchModal from './SearchModal'; // Import search modal

const API_URL = "http://192.168.15.120:3000";

export default function ActivityLogScreen() {
  const navigation = useNavigation();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [searchVisible, setSearchVisible] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState(null);

  const fetchLogs = async (p = 1, replace = true, criteria = null) => {
    if (loading || p < 1 || (totalPages && p > totalPages)) return;
    setLoading(true);
    try {
      let url = `${API_URL}/api/activity?page=${p}&limit=20`;

      if (criteria) {
        if (criteria.startDate) {
          url += `&start=${criteria.startDate.toISOString().split('T')[0]}`;
        }
        if (criteria.endDate) {
          url += `&end=${criteria.endDate.toISOString().split('T')[0]}`;
        }
        if (criteria.type && criteria.type !== 'all') {
          url += `&type=${criteria.type}`;
        }
        if (criteria.status && criteria.status !== 'all') {
          url += `&status=${criteria.status}`;
        }
        if (criteria.keyword) {
          url += `&keyword=${encodeURIComponent(criteria.keyword)}`;
        }
      }

      const res = await fetch(url);
      const json = await res.json();
      setLogs(replace ? json.data : [...logs, ...json.data]);
      setPage(json.page);
      setTotalPages(json.totalPages);
    } catch (e) {
      console.error("Fetch activity error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1, true, filterCriteria);
  }, []);

  const applySearch = (criteria) => {
    setFilterCriteria(criteria);
    fetchLogs(1, true, criteria);
  };

  const goPrev = () => fetchLogs(page - 1, true, filterCriteria);
  const goNext = () => fetchLogs(page + 1, true, filterCriteria);

  const renderItem = useCallback(({ item }) => <LogItem item={item} />, []);

  const getItemLayout = (data, index) => ({
    length: 90, // chiều cao mỗi dòng ước lượng
    offset: 90 * index,
    index,
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity Log</Text>

        {/* Search Button */}
        <TouchableOpacity onPress={() => setSearchVisible(true)} style={styles.searchBtn}>
          <Text style={styles.backText}>🔍</Text>
        </TouchableOpacity>
      </View>

      {/* Log list */}
      <FlatList
        data={logs}
        keyExtractor={i => `${i.log_id}-${i.timestamps}`}
        renderItem={renderItem}
        initialNumToRender={10}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={getItemLayout}
        contentContainerStyle={{ paddingTop: 0 }}
        ListFooterComponent={loading ? <ActivityIndicator style={{ marginVertical: 16 }} /> : null}
      />

      {/* Pagination controls */}
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageBtn, page <= 1 && styles.disabledBtn]}
          onPress={goPrev}
          disabled={page <= 1}
        >
          <Text style={styles.pageText}>‹ Prev</Text>
        </TouchableOpacity>

        <Text style={styles.pageInfo}>
          Page {page} / {totalPages || 1}
        </Text>

        <TouchableOpacity
          style={[styles.pageBtn, page >= totalPages && styles.disabledBtn]}
          onPress={goNext}
          disabled={page >= totalPages}
        >
          <Text style={styles.pageText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      {/* Search Modal */}
      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onApply={applySearch}
      />
    </SafeAreaView>
  );
}

// 👇 React.memo component cho mỗi log
const LogItem = React.memo(({ item }) => {
  const timeStr = new Date(item.timestamps).toLocaleString();

  if (item.type) {
    const deviceLabel = item.type === 'minifan' ? '🌀 Fan' : '💡 Light';
    const statusLabel = item.status === 1 ? 'ON' : 'OFF';
    const statusColor = item.status === 1 ? '#2ecc71' : '#e74c3c';
    return (
      <View style={styles.row}>
        <Text style={styles.ts}>{timeStr}</Text>
        <Text>{deviceLabel} <Text style={{ color: statusColor }}>{statusLabel}</Text></Text>
      </View>
    );
  } else {
    return (
      <View style={styles.row}>
        <Text style={styles.ts}>{timeStr}</Text>
        <Text>🌡 {item.temperature}°C   💧 {item.humidity}%</Text>
        <Text>💡 {item.light_intensity} lux   🔎 {item.current_status ? 'Detected' : 'None'}</Text>
      </View>
    );
  }
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerBar: {
    height: 100,
    backgroundColor: '#50C2C9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  backBtn: { position: 'absolute', left: 16, padding: 8, top: 50 },
  searchBtn: { position: 'absolute', right: 16, padding: 8, top: 50 },
  backText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '600', top: 17 },
  row: { borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 12, paddingHorizontal: 8 },
  ts: { fontSize: 12, color: '#666', marginBottom: 4 },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#50C2C9', borderRadius: 6, marginHorizontal: 8 },
  disabledBtn: { backgroundColor: '#ccc' },
  pageText: { color: '#fff', fontWeight: '600' },
  pageInfo: { fontSize: 14, fontWeight: '500' }
});
