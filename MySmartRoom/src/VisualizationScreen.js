import React, { useEffect, useState, useMemo } from 'react';
import {
  ScrollView,
  Text,
  StyleSheet,
  Dimensions,
  View,
  TouchableOpacity,
  Button,
  Platform,
  Modal,
} from 'react-native';
import {
  LineChart,
  BarChart,
  YAxis,
  XAxis,
  Grid,
} from 'react-native-svg-charts';
import { Circle } from 'react-native-svg';
import * as shape from 'd3-shape';
import axios from 'axios';
import io from 'socket.io-client';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';

const SERVER_URL = 'http://192.168.15.120:3000';
const { width } = Dimensions.get('window');
const POINT_WIDTH = 40;
const CHART_HEIGHT = 220;

export default function VisualizationScreen({ navigation }) {
  const [dateLabel, setDateLabel] = useState('');
  const [hourLabels, setHourLabels] = useState([]);
  const [tempData, setTempData] = useState([]);
  const [humidData, setHumidData] = useState([]);
  const [lightData, setLightData] = useState([]);
  const [pointDates, setPointDates] = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [selectedData, setSelectedData] = useState(null);

  const [fanTime, setFanTime] = useState(0);
  const [lightTime, setLightTime] = useState(0);

  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [filterLabel, setFilterLabel] = useState('Select range');
  const [showFilter, setShowFilter] = useState(false);

  const [showTemp, setShowTemp] = useState(true);
  const [showHumid, setShowHumid] = useState(true);

  const [zoomScale, setZoomScale] = useState(1);
  const zoomIn = () => setZoomScale(s => Math.min(s + 0.2, 3));
  const zoomOut = () => setZoomScale(s => Math.max(s - 0.2, 0.5));

  const tempMin = 0, tempMax = 40;
  const humidMin = 0, humidMax = 100;
  const lightMin = 0, lightMax = 100;
  const contentInset = { top: 10, bottom: 10 };

  useEffect(() => {
    fetchData();
    fetchActiveTime();
    const sock = io(SERVER_URL, { transports: ['websocket'] });
    sock.on('newData', fetchData);
    sock.on('newOutputData', fetchActiveTime);
    return () => sock.disconnect();
  }, []);

  const fmt = d => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const fillState = json => {
    setDateLabel(json.dateLabel || '');
    setHourLabels(json.hourLabels || []);
    setTempData(json.tempArr || []);
    setHumidData(json.humidArr || []);
    setLightData(json.lightArr || []);
    setPointDates(json.dateArr || (json.hourLabels || []).map(() => json.dateLabel));
    setSelectedIdx(null);
    setSelectedData(null);
  };

  const fetchData = () => axios.get(`${SERVER_URL}/api/hourly-history`).then(r => fillState(r.data));

  const fetchActiveTime = () => axios.get(`${SERVER_URL}/api/active-time`).then(r => {
    setFanTime(r.data.fan_hours || 0);
    setLightTime(r.data.light_hours || 0);
  }).catch(e => console.error('Error fetching active time:', e));

  const fetchRange = (s, e) => axios.get(`${SERVER_URL}/api/hourly-history?start=${s}&end=${e}`).then(r => fillState(r.data));

  const applyRange = (s, e, label) => {
    setStartDate(s);
    setEndDate(e);
    setFilterLabel(label);
    setShowFilter(false);
    fetchRange(fmt(s), fmt(e));
  };

  const today = () => { const d = new Date(); applyRange(d, d, 'Today'); };
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); applyRange(d, d, 'Yesterday'); };
  const thisMonth = () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth(), 1); applyRange(s, e, 'This Month'); };
  const last30 = () => { const e = new Date(); const s = new Date(e.getTime() - 29 * 864e5); applyRange(s, e, 'Last 30 Days'); };
  const lastMonth = () => { const n = new Date(); const s = new Date(n.getFullYear(), n.getMonth() - 1, 1); const e = new Date(n.getFullYear(), n.getMonth(), 0); applyRange(s, e, 'Last Month'); };
  const last3 = () => { const e = new Date(); const s = new Date(e.getFullYear(), e.getMonth() - 2, 1); applyRange(s, e, 'Last 3 Months'); };

  const selectPoint = i => {
    setSelectedIdx(i);
    setSelectedData({
      date: pointDates[i],
      hour: hourLabels[i],
      temp: tempData[i]?.toFixed(2),
      humid: humidData[i]?.toFixed(2),
      light: lightData[i]?.toFixed(2),
    });
  };

  const barData = useMemo(() => humidData.map((v, i) => ({
    value: v,
    svg: {
      fill: selectedIdx === i ? 'rgba(30,90,255,0.55)' : 'rgba(0,0,255,0.3)',
      onPress: () => selectPoint(i),
    },
  })), [humidData, selectedIdx]);

  const lineData = useMemo(() => tempData.map((v, i) => ({ value: v, index: i })), [tempData]);
  const lightLineData = useMemo(() => lightData.map((v, i) => ({ value: v, index: i })), [lightData]);

  const TempDecorator = ({ x, y, data }) => data.map((d, i) => {
    const cx = x(i + 0.5), cy = y(d.value), sel = i === selectedIdx;
    return (
      <React.Fragment key={i}>
        <Circle cx={cx} cy={cy} r={14} fill="rgba(0,0,0,0.001)" onPress={() => selectPoint(i)} />
        <Circle cx={cx} cy={cy} r={sel ? 6 : 4} stroke="red" strokeWidth={sel ? 2 : 1} fill={sel ? 'white' : 'transparent'} />
      </React.Fragment>
    );
  });

  const LightDecorator = ({ x, y, data }) => data.map((d, i) => {
    const cx = x(i + 0.5), cy = y(d.value), sel = i === selectedIdx;
    return (
      <React.Fragment key={i}>
        <Circle cx={cx} cy={cy} r={14} fill="rgba(0,0,0,0.001)" onPress={() => selectPoint(i)} />
        <Circle cx={cx} cy={cy} r={sel ? 6 : 4} stroke="green" strokeWidth={sel ? 2 : 1} fill={sel ? 'white' : 'transparent'} />
      </React.Fragment>
    );
  });

  const chartWidth = Math.max(hourLabels.length * POINT_WIDTH * zoomScale, width - 80);
  const noData = hourLabels.length === 0;

  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" style={{ paddingTop: 20 }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Visualization</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.activeTimeRow}>
  <View style={styles.activeCard}>
    <Text style={styles.activeLabel}>Fan Active</Text>
    <Text style={styles.activeValue}>{Number(fanTime || 0).toFixed(2)} hrs</Text>
  </View>
  <View style={styles.activeCard}>
    <Text style={styles.activeLabel}>Light Active</Text>
    <Text style={styles.activeValue}>{Number(lightTime || 0).toFixed(2)} hrs</Text>
  </View>
</View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Humidity & Temperature</Text>
          {dateLabel ? <Text style={styles.dateLabel}>Date: {dateLabel}</Text> : null}

          <TouchableOpacity style={styles.filterBtn} onPress={() => setShowFilter(true)}>
            <Text style={styles.filterTxt}>{filterLabel} ▼</Text>
          </TouchableOpacity>

          <Modal transparent visible={showFilter} animationType="fade">
            <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowFilter(false)} />
            <View style={styles.modalPanel}>
              <View style={styles.modalRow}>
                <Text>From:</Text>
                <TouchableOpacity style={styles.modalDateBtn} onPress={() => setShowStart(true)}>
                  <Text>{fmt(startDate)}</Text>
                </TouchableOpacity>
                <Text>To:</Text>
                <TouchableOpacity style={styles.modalDateBtn} onPress={() => setShowEnd(true)}>
                  <Text>{fmt(endDate)}</Text>
                </TouchableOpacity>
              </View>
              {showStart && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => { setShowStart(false); if (d) setStartDate(d); }}
                />
              )}
              {showEnd && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, d) => { setShowEnd(false); if (d) setEndDate(d); }}
                />
              )}
              <Button title="Apply" onPress={() => applyRange(startDate, endDate, `${fmt(startDate)} → ${fmt(endDate)}`)} />
              <View style={styles.presetList}>
                <Button title="Today" onPress={today} />
                <Button title="Yesterday" onPress={yesterday} />
                <Button title="This Month" onPress={thisMonth} />
                <Button title="Last 30 Days" onPress={last30} />
                <Button title="Last Month" onPress={lastMonth} />
                <Button title="Last 3 Months" onPress={last3} />
              </View>
            </View>
          </Modal>

          <View style={styles.toggleRow}>
            <TouchableOpacity style={[styles.toggleBtn, showTemp && styles.toggleActive]} onPress={() => setShowTemp(!showTemp)}>
              <Text style={[styles.toggleTxt, showTemp && styles.toggleTxtActive]}>Temp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.toggleBtn, showHumid && styles.toggleActive]} onPress={() => setShowHumid(!showHumid)}>
              <Text style={[styles.toggleTxt, showHumid && styles.toggleTxtActive]}>Humid</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.zoomRow}>
            <TouchableOpacity style={styles.zoomBtn} onPress={zoomOut}>
              <Text style={styles.zoomTxt}>–</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.zoomBtn} onPress={zoomIn}>
              <Text style={styles.zoomTxt}>+</Text>
            </TouchableOpacity>
          </View>

          {noData ? (
            <View style={[styles.chartContainer, { height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.noDataText}>No data found</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <YAxis data={[tempMin, tempMax]} style={styles.yAxis} contentInset={contentInset}
                svg={{ fill: 'red', fontSize: 12 }} numberOfTicks={5} formatLabel={v => `${v}°C`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: chartWidth }}>
                <View style={{ width: chartWidth, height: CHART_HEIGHT }}>
                  {showTemp && (
                    <LineChart
                      style={StyleSheet.absoluteFill}
                      data={lineData}
                      yAccessor={({ item }) => item.value}
                      xAccessor={({ item }) => item.index + 0.5}
                      xMin={0}
                      xMax={hourLabels.length}
                      yMin={tempMin}
                      yMax={tempMax}
                      contentInset={contentInset}
                      svg={{ stroke: 'red', strokeWidth: 1.5 }}
                      curve={shape.curveMonotoneX}
                    >
                      <TempDecorator />
                    </LineChart>
                  )}
                  {showHumid && (
                    <BarChart
                      style={StyleSheet.absoluteFill}
                      data={barData}
                      yAccessor={({ item }) => item.value}
                      xAccessor={({ item, i }) => i}
                      yMin={humidMin}
                      yMax={humidMax}
                      spacingInner={0.3}
                      spacingOuter={0.1}
                      contentInset={contentInset}
                    >
                      <Grid direction={Grid.Direction.HORIZONTAL} />
                    </BarChart>
                  )}
                </View>
                <XAxis
                  style={styles.xAxis}
                  data={barData}
                  xAccessor={({ item, i }) => i + 0.5}
                  formatLabel={(_, i) => hourLabels[i] || ''}
                  contentInset={{ left: POINT_WIDTH * zoomScale * 0.1, right: POINT_WIDTH * zoomScale * 0.1 }}
                  svg={{ fontSize: 12, fill: '#333' }}
                />
              </ScrollView>
              <YAxis data={[humidMin, humidMax]} style={styles.yAxisRight} contentInset={contentInset}
                svg={{ fill: 'blue', fontSize: 12 }} numberOfTicks={5} formatLabel={v => `${v}%`} />
            </View>
          )}

          <View style={styles.detailBox}>
            {selectedData ? (
              <>
                <Text style={styles.detailTxt}>Date: {selectedData.date}</Text>
                <Text style={styles.detailTxt}>Time: {selectedData.hour}:00</Text>
                <Text style={styles.detailTxt}>Temp: {selectedData.temp}°C</Text>
                <Text style={styles.detailTxt}>Humid: {selectedData.humid}%</Text>
                <Text style={styles.detailTxt}>Light: {selectedData.light}cd</Text>
              </>
            ) : (
              <Text style={styles.detailTxt}>Select a column to see details</Text>
            )}
          </View>
        </View>

        {/* Light Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Light Intensity</Text>
          {dateLabel ? <Text style={styles.dateLabel}>Date: {dateLabel}</Text> : null}

          {noData ? (
            <View style={[styles.chartContainer, { height: CHART_HEIGHT, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={styles.noDataText}>No data found</Text>
            </View>
          ) : (
            <View style={styles.chartContainer}>
              <YAxis data={[lightMin, lightMax]} style={styles.yAxis} contentInset={contentInset}
                svg={{ fill: 'green', fontSize: 12 }} numberOfTicks={5} formatLabel={v => `${v}cd`} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width: chartWidth }}>
                <View style={{ width: chartWidth, height: CHART_HEIGHT }}>
                  <LineChart
                    style={StyleSheet.absoluteFill}
                    data={lightLineData}
                    yAccessor={({ item }) => item.value}
                    xAccessor={({ item }) => item.index + 0.5}
                    xMin={0}
                    xMax={hourLabels.length}
                    yMin={lightMin}
                    yMax={lightMax}
                    contentInset={contentInset}
                    svg={{ stroke: 'yellow', strokeWidth: 2 }}
                    curve={shape.curveMonotoneX}
                  >
                    <LightDecorator />
                  </LineChart>
                </View>
                <XAxis
                  style={styles.xAxis}
                  data={lightLineData}
                  xAccessor={({ item, i }) => i + 0.5}
                  formatLabel={(_, i) => hourLabels[i] || ''}
                  contentInset={{ left: POINT_WIDTH * zoomScale * 0.1, right: POINT_WIDTH * zoomScale * 0.1 }}
                  svg={{ fontSize: 12, fill: '#333' }}
                />
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E8F2F8' },
  headerBar: { height: 100, backgroundColor: '#50C2C9', paddingTop: Platform.OS === 'ios' ? 50 : 30, paddingBottom: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontWeight: 'bold', textAlign: 'center', paddingTop: 20 },
  scroll: { padding: 16, paddingBottom: 100 },
  activeTimeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  activeCard: { flex: 1, backgroundColor: '#fff', marginHorizontal: 5, paddingVertical: 16, borderRadius: 10, alignItems: 'center', elevation: 3 },
  activeLabel: { fontSize: 14, color: '#666', marginBottom: 6 },
  activeValue: { fontSize: 20, fontWeight: 'bold', color: '#50C2C9' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, elevation: 3 },
  cardTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  dateLabel: { color: '#666', marginBottom: 8 },
  filterBtn: { backgroundColor: '#50C2C9', padding: 8, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 12 },
  filterTxt: { color: '#fff', fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalPanel: { position: 'absolute', top: 120, left: 20, right: 20, backgroundColor: '#fff', borderRadius: 8, padding: 16, elevation: 5 },
  modalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalDateBtn: { padding: 6, borderWidth: 1, borderColor: '#ccc', borderRadius: 4 },
  presetList: { marginTop: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: '#007BFF', borderRadius: 6, marginHorizontal: 8 },
  toggleActive: { backgroundColor: '#007BFF' },
  toggleTxt: { color: '#007BFF', fontWeight: 'bold' },
  toggleTxtActive: { color: '#fff' },
  zoomRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  zoomBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: '#007BFF', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  zoomTxt: { fontSize: 20, color: '#007BFF', fontWeight: 'bold' },
  chartContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  yAxis: { marginRight: 6 },
  yAxisRight: { marginLeft: 6 },
  xAxis: { height: 20, marginTop: 4 },
  noDataText: { fontSize: 16, color: '#999' },
  detailBox: { backgroundColor: '#fff', padding: 12, marginTop: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ccc' },
  detailTxt: { fontSize: 14, marginBottom: 4, color: '#333' },
});

