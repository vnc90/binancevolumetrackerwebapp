'use client';

import { useEffect, useState, useRef } from 'react';
import VolumeTable from './components/VolumeTable';
import AlertHistory from './components/AlertHistory';

type CoinData = {
  symbol: string;
  baseAsset: string;
  fullName?: string;
  logoUrl?: string;
  currentPrice: number;
  currentVolume: number;
  changes: {
    price: {
      percent: number;
    };
    volume: {
      percent: number;
    };
  };
  timestamp: number;
};

type AlertData = CoinData & {
  alertTime: number;
};

// Theo dõi thời gian cảnh báo gần nhất của mỗi coin
type AlertTimeMap = {
  [symbol: string]: number;
};

// Thời gian tối thiểu giữa các cảnh báo cho cùng một coin (60 giây)
const MIN_ALERT_INTERVAL = 60 * 1000;
// Thời gian để dữ liệu hết hạn (3 phút - đồng bộ với đồng hồ đếm ngược)
const DATA_EXPIRY_TIME = 180 * 1000;

export default function Home() {
  const [status, setStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<string>('Chưa có dữ liệu');
  const [nextUpdateCountdown, setNextUpdateCountdown] = useState<number>(180); // 3 phút = 180 giây
  const [alerts, setAlerts] = useState<Map<string, CoinData>>(new Map());
  const [minVolume, setMinVolume] = useState<number>(10000);
  const [alertThreshold, setAlertThreshold] = useState<number>(2.5);
  const [alertHistory, setAlertHistory] = useState<AlertData[]>([]);
  const userInteracted = true; // Always true since we removed user interaction detection
  const [showPopupWarning, setShowPopupWarning] = useState<boolean>(false);
  // Lưu trữ thời gian cảnh báo gần nhất cho mỗi coin
  const [lastAlertTimes, setLastAlertTimes] = useState<AlertTimeMap>({});
  const socketRef = useRef<WebSocket | null>(null);
  const pendingChartsRef = useRef<string[]>([]);
  const lastCleanupRef = useRef<number>(Date.now());
  
  // Countdown timer cho lần cập nhật tiếp theo
  useEffect(() => {
    // Chỉ bắt đầu đếm ngược khi đã có dữ liệu (lastUpdate khác "Chưa có dữ liệu")
    if (lastUpdate === 'Chưa có dữ liệu' || status === 'disconnected') {
      return;
    }

    // Reset countdown về 180 giây (3 phút) khi có cập nhật mới
    setNextUpdateCountdown(180);
    
    // Tạo interval để giảm countdown mỗi giây
    const intervalId = setInterval(() => {
      setNextUpdateCountdown(prev => {
        if (prev <= 0) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    // Xóa interval khi component unmount hoặc khi có cập nhật mới
    return () => clearInterval(intervalId);
  }, [lastUpdate, status]);

  function updateLastUpdate() {
    const now = new Date();
    setLastUpdate(now.toLocaleTimeString());
    // Reset đồng hồ đếm ngược
    setNextUpdateCountdown(180);
    
    // Gọi hàm làm sạch dữ liệu khi có cập nhật mới
    cleanupExpiredData();
  }

  // Xử lý thay đổi giá trị volume tối thiểu
  const handleMinVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setMinVolume(value);
      localStorage.setItem('minVolume', value.toString());
    }
  };

  // Xử lý thay đổi ngưỡng cảnh báo
  const handleAlertThresholdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0) {
      setAlertThreshold(value);
      localStorage.setItem('alertThreshold', value.toString());
    }
  };

  // Mở biểu đồ giao dịch
  const openTradingChart = (symbol: string, force: boolean = false) => {
    try {
      // Xử lý format symbol
      // Ví dụ: "BTCUSDT" => "BTC_USDT", "BTC/USDT" => "BTC_USDT"
      let formattedSymbol = symbol;
      
      // Nếu symbol có dạng "BTCUSDT", thêm dấu "_" giữa base và quote asset
      if (!/[/_-]/.test(symbol) && symbol.endsWith('USDT')) {
        const baseAsset = symbol.substring(0, symbol.length - 4);
        formattedSymbol = `${baseAsset}_USDT`;
      } else {
        // Nếu symbol có dạng "BTC/USDT" hoặc "BTC-USDT", thay thế dấu phân cách bằng "_"
        formattedSymbol = symbol.replace('/', '_').replace('-', '_');
      }
      
      const url = `https://www.binance.com/vi/trade/${formattedSymbol}?type=spot`;
      
      // Kiểm tra xem người dùng đã tương tác chưa hoặc force = true
      if (userInteracted || force) {
        const newWindow = window.open(url, '_blank');
        
        // Kiểm tra nếu popup bị chặn
        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          setShowPopupWarning(true);
          return false;
        }
        
        return true;
      } else {
        // Nếu người dùng chưa tương tác, thêm vào danh sách chờ
        if (!pendingChartsRef.current.includes(symbol)) {
          pendingChartsRef.current.push(symbol);
        }
        return false;
      }
    } catch {
      return false;
    }
  };

  // Khôi phục cài đặt từ localStorage khi component mount
  useEffect(() => {
    // Khôi phục giá trị volume tối thiểu
    const savedMinVolume = localStorage.getItem('minVolume');
    if (savedMinVolume) {
      const value = parseInt(savedMinVolume);
      if (!isNaN(value) && value >= 0) {
        setMinVolume(value);
      }
    }

    // Khôi phục ngưỡng cảnh báo
    const savedAlertThreshold = localStorage.getItem('alertThreshold');
    if (savedAlertThreshold) {
      const value = parseFloat(savedAlertThreshold);
      if (!isNaN(value) && value >= 0) {
        setAlertThreshold(value);
      }
    }
  }, []);

  // Kiểm tra dữ liệu hợp lệ trước khi thêm vào state
  function isValidCoinData(data: Record<string, unknown>): boolean {
    try {
      // Kiểm tra các trường bắt buộc
      if (!data || typeof data !== 'object') return false;
      if (!data.symbol || typeof data.symbol !== 'string') return false;
      
      // Đảm bảo các trường dữ liệu có cấu trúc đúng, nếu không gán giá trị mặc định
      if (data.currentPrice === undefined || data.currentPrice === null) {
        data.currentPrice = 0;
      }
      
      if (data.currentVolume === undefined || data.currentVolume === null) {
        data.currentVolume = 0;
      }
      
      // Đảm bảo cấu trúc changes tồn tại
      if (!data.changes) {
        data.changes = {
          price: { percent: 0 },
          volume: { percent: 0 }
        };
      } else {
        // Kiểm tra và sửa chữa cấu trúc price nếu cần
        if (!data.changes.price) {
          data.changes.price = { percent: 0 };
        } else if (data.changes.price.percent === undefined || data.changes.price.percent === null) {
          data.changes.price.percent = 0;
        }
        
        // Kiểm tra và sửa chữa cấu trúc volume nếu cần
        if (!data.changes.volume) {
          data.changes.volume = { percent: 0 };
        } else if (data.changes.volume.percent === undefined || data.changes.volume.percent === null) {
          data.changes.volume.percent = 0;
        }
      }
      
      // Đảm bảo timestamp tồn tại
      if (!data.timestamp) {
        data.timestamp = Date.now();
      }
      
      return true;
    } catch {
      return false;
    }
  }

  // Kiểm tra xem coin có nên được cảnh báo không
  function shouldTriggerAlert(symbol: string, volumeChangePercent: number): boolean {
    try {
      // Chuyển đổi phần trăm thành số lần (5000% = 50 lần)
      const volumeChangeTimes = volumeChangePercent / 100;
      
      // Nếu không đạt ngưỡng cảnh báo, không cần cảnh báo
      if (volumeChangeTimes < alertThreshold) {
        return false;
      }
      
      const now = Date.now();
      const lastAlertTime = lastAlertTimes[symbol] || 0;
      
      // Nếu đã qua khoảng thời gian tối thiểu từ lần cảnh báo trước, hoặc chưa từng cảnh báo
      if ((now - lastAlertTime) >= MIN_ALERT_INTERVAL) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  // Hàm làm sạch dữ liệu cũ
  function cleanupExpiredData() {
    const now = Date.now();
    // Chỉ làm sạch dữ liệu mỗi 30 giây
    if (now - lastCleanupRef.current < 30000) {
      return;
    }
    
    // Cập nhật thời gian làm sạch gần nhất
    lastCleanupRef.current = now;
    
    setAlerts(prev => {
      // Không thay đổi gì nếu không có dữ liệu
      if (prev.size === 0) return prev;
      
      const newAlerts = new Map(prev);
      let hasDeleted = false;
      
      // Xóa dữ liệu cũ
      for (const [symbol, coinData] of newAlerts.entries()) {
        if (now - coinData.timestamp > DATA_EXPIRY_TIME) {
          newAlerts.delete(symbol);
          hasDeleted = true;
        }
      }
      
      // Chỉ trả về Map mới nếu có thay đổi
      return hasDeleted ? newAlerts : prev;
    });
  }

  // Hàm xử lý dữ liệu coin mới
  function handleCoinData(data: CoinData) {
    try {
      // Kiểm tra dữ liệu trước khi thêm vào state
      if (!isValidCoinData(data)) {
        return;
      }
      
      // Đảm bảo timestamp luôn được cập nhật thành thời gian hiện tại
      data.timestamp = Date.now();
      
      // Kiểm tra cảnh báo
      const volumeChangePercent = data.changes.volume.percent;
      
      const shouldAlert = shouldTriggerAlert(data.symbol, volumeChangePercent);
      
      // Nếu cần cảnh báo
      if (shouldAlert) {
        // Cập nhật thời gian cảnh báo gần nhất
        const now = Date.now();
        setLastAlertTimes(prev => ({
          ...prev,
          [data.symbol]: now
        }));
        
        // Thêm vào lịch sử cảnh báo
        const alertData: AlertData = {
          ...data,
          alertTime: now
        };
        
        setAlertHistory(prev => [alertData, ...prev].slice(0, 100)); // Giới hạn 100 mục
      }
      
      setAlerts(prev => {
        const newAlerts = new Map(prev);
        
        // Kiểm tra xem symbol đã tồn tại chưa
        if (newAlerts.has(data.symbol)) {
          // Xóa dữ liệu cũ
          newAlerts.delete(data.symbol);
        }
        
        // Thêm dữ liệu mới với timestamp hiện tại
        newAlerts.set(data.symbol, data);
        
        // Sắp xếp dữ liệu theo thời gian để dữ liệu mới nhất lên đầu
        return new Map(
          Array.from(newAlerts.entries())
            .sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0))
        );
      });
    } catch {
      // Xử lý lỗi nếu có
    }
  }

  function connect() {
    // Kết nối đến WebSocket server
    try {
      socketRef.current = new WebSocket('ws://113.160.154.85:9090');
      
      socketRef.current.onopen = function() {
        setStatus('connected');
        // Reset dữ liệu khi kết nối mới
        setAlerts(new Map());
      };
      
      socketRef.current.onerror = function() {
        setStatus('disconnected');
      };
      
      socketRef.current.onclose = function() {
        setStatus('disconnected');
      };
      
      socketRef.current.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection') {
            return;
          }
          
          if (data.type === 'volume_alert') {
            updateLastUpdate();
            handleCoinData(data);
          }
        } catch {
          // Xử lý lỗi nếu có
        }
      };
    } catch {
      setStatus('disconnected');
    }
  }

  // Sửa lỗi useEffect missing dependency
  useEffect(() => {
    // Kết nối khi trang được tải
    connect();

    // Dọn dẹp khi component unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
    }
    connect();
  };

  // Thêm hàm xóa tất cả dữ liệu
  const handleClearAll = () => {
    setAlerts(new Map());
    setLastUpdate('Đã xóa dữ liệu');
    // Reset đồng hồ đếm ngược
    setNextUpdateCountdown(180);
  };

  // Xóa lịch sử cảnh báo
  const handleClearAlertHistory = () => {
    setAlertHistory([]);
    // Đồng thời reset thời gian cảnh báo gần nhất
    setLastAlertTimes({});
  };

  // Xóa các cảnh báo dưới ngưỡng hiện tại
  const handleClearBelowThreshold = () => {
    // Lọc giữ lại các cảnh báo có thay đổi volume >= ngưỡng hiện tại
    const filteredHistory = alertHistory.filter(alert => {
      const volumeChangeTimes = alert.changes.volume.percent / 100;
      return volumeChangeTimes >= alertThreshold;
    });
    
    // Cập nhật lịch sử cảnh báo chỉ với các cảnh báo đạt ngưỡng
    setAlertHistory(filteredHistory);
    
    // Cập nhật lastAlertTimes để chỉ giữ lại các coins đạt ngưỡng
    const newLastAlertTimes = {...lastAlertTimes};
    for (const symbol in newLastAlertTimes) {
      const coin = alertHistory.find(alert => alert.symbol === symbol);
      if (!coin || coin.changes.volume.percent / 100 < alertThreshold) {
        delete newLastAlertTimes[symbol];
      }
    }
    setLastAlertTimes(newLastAlertTimes);
  };

  // Lọc các alerts có volume thấp hơn giá trị minVolume
  const filteredAlerts = new Map(
    Array.from(alerts.entries()).filter(([symbol]) => {
      const data = alerts.get(symbol);
      return data && data.currentVolume >= minVolume;
    })
  );

  // Lọc lịch sử cảnh báo dựa trên giá trị minVolume và ngưỡng hiện tại
  const filteredAlertHistory = alertHistory.filter(alert => {
    // Lọc theo volume tối thiểu
    if (alert.currentVolume < minVolume) return false;
    
    // Lọc theo ngưỡng thay đổi volume hiện tại
    const volumeChangeTimes = alert.changes.volume.percent / 100;
    return volumeChangeTimes >= alertThreshold;
  });

  // Effect để tự động làm sạch dữ liệu cũ
  useEffect(() => {
    // Chỉ thiết lập interval khi đã kết nối
    if (status !== 'connected') {
      return;
    }
    
    // Force cleanup khi trạng thái kết nối thay đổi
    cleanupExpiredData();
    
    // Thiết lập một interval để kiểm tra và xóa dữ liệu cũ mỗi 30 giây
    const cleanupInterval = setInterval(() => {
      cleanupExpiredData();
    }, 30000); // Kiểm tra mỗi 30 giây
    
    return () => clearInterval(cleanupInterval);
  }, [status]);

  // Format countdown từ giây sang phút:giây
  const formatCountdown = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
  };

  return (
    <div className="p-5 bg-gray-100 min-h-screen">
      <div className="max-w-full mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 pb-2.5 border-b-2 border-[#f0b90b]">
          Binance Volume Tracker
        </h1>
        
        <div className="flex justify-between items-center mt-5">
          <div className={`p-1 rounded text-sm font-medium ${
            status === 'connected' 
              ? 'bg-green-100 text-green-800 border border-green-200' 
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}>
            {status === 'connected' ? 'Đã kết nối' : 'Chưa kết nối'}
          </div>
          
          <div className="flex space-x-2">
            <button 
              onClick={handleReconnect}
              className="bg-[#f0b90b] hover:bg-[#e0aa0b] text-white text-sm font-medium py-1 px-3 rounded"
            >
              Kết nối lại
            </button>
            
            <button 
              onClick={handleClearAll}
              className="bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-1 px-3 rounded"
            >
              Xóa tất cả
            </button>
          </div>
        </div>
        
        {showPopupWarning && (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mt-4">
            <div className="flex items-center">
              <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="font-semibold">Cảnh báo:</span>
              <span className="ml-2">Trình duyệt đang chặn cửa sổ popup. Vui lòng cho phép popup từ trang web này để sử dụng tính năng mở biểu đồ.</span>
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-3">
          <div className="lg:col-span-3">
            <div className="bg-white p-5 rounded-lg shadow-md">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="text-sm text-gray-500 flex items-center">
                  Cập nhật lần cuối: <span className="mx-1">{lastUpdate}</span>
                  {status === 'connected' && lastUpdate !== 'Chưa có dữ liệu' && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      Cập nhật tiếp theo: {formatCountdown(nextUpdateCountdown)}
                    </span>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="minVolume" className="text-sm font-medium text-gray-700">
                      Volume tối thiểu:
                    </label>
                    <input
                      id="minVolume"
                      type="number"
                      min="0"
                      value={minVolume}
                      onChange={handleMinVolumeChange}
                      className="border text-xs border-gray-300 rounded px-3 py-1 w-22 focus:outline-none focus:ring-2 focus:ring-[#f0b90b] focus:border-transparent"
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <label htmlFor="alertThreshold" className="text-sm font-medium text-gray-700">
                      Ngưỡng cảnh báo (x lần):
                    </label>
                    <input
                      id="alertThreshold"
                      type="number"
                      min="0"
                      step="0.1"
                      value={alertThreshold}
                      onChange={handleAlertThresholdChange}
                      className="border text-xs border-gray-300 rounded px-3 py-1 w-16 focus:outline-none focus:ring-2 focus:ring-[#f0b90b] focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-4">
                <div>
                  Tổng số coin: <span className="font-semibold">{alerts.size}</span>
                </div>
                <div>
                  Hiển thị: <span className="font-semibold">{filteredAlerts.size}</span>
                </div>
                <div className="text-xs text-gray-400">
                  (Đã lọc {alerts.size - filteredAlerts.size} coin có volume &lt; {minVolume})
                </div>
              </div>
              
              {/* Bảng chính */}
              <VolumeTable alerts={filteredAlerts} />
            </div>
          </div>
          
          <div className="lg:col-span-1">
            <div className="bg-white p-5 rounded-lg shadow-md h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-800">Lịch sử cảnh báo</h2>
                <div className="flex items-center gap-2">
                  <button
                    hidden={true}
                    onClick={handleClearBelowThreshold}
                    className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-1 px-2 rounded"
                    title="Xóa cảnh báo dưới ngưỡng hiện tại"
                  >
                    Lọc ngưỡng
                  </button>
                  <button
                    onClick={handleClearAlertHistory}
                    className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-1 px-2 rounded"
                  >
                    Xóa lịch sử
                  </button>
                </div>
              </div>
              
              {/* Hiển thị thông tin về số lượng cảnh báo đang hiển thị
                <div className="text-xs text-gray-500 mb-2 flex flex-wrap items-center gap-2">
                  <div>
                    Cảnh báo: <span className="font-semibold">{filteredAlertHistory.length}</span>/{alertHistory.length}
                  </div>
                  {alertHistory.length > filteredAlertHistory.length && (
                    <div className="text-xs text-gray-400">
                      (Đã lọc {alertHistory.length - filteredAlertHistory.length} cảnh báo dưới ngưỡng {alertThreshold}x)
                    </div>
                  )}
                </div> */}
              
              {/* Bảng lịch sử cảnh báo */}
              <div className="h-[calc(100vh-250px)]">
                <AlertHistory alerts={filteredAlertHistory} openTradingChart={openTradingChart} />
              </div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-4">
          <div className="flex justify-center w-full pt-1">
            {/* copyright and author name, team name */}
            <span >© 2025 <a href="https://www.facebook.com/vungocchuong" className="text-blue-500">VNC</a> - MetaBot Team</span>
          </div>
          
        </div>
      </div>
    </div>
  );
}
