'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';

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

type VolumeTableProps = {
  alerts: Map<string, CoinData>;
};

// Các trường có thể sort
type SortableField = 'price' | 'priceChange' | 'volume' | 'volumeChange';
type SortDirection = 'asc' | 'desc';

type SortConfig = {
  field: SortableField;
  direction: SortDirection;
};

export default function VolumeTable({ alerts }: VolumeTableProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Khôi phục cấu hình sort từ localStorage khi component mount
  useEffect(() => {
    const savedSortConfig = localStorage.getItem('volumeTableSortConfig');
    if (savedSortConfig) {
      try {
        const parsedConfig = JSON.parse(savedSortConfig) as SortConfig;
        setSortConfig(parsedConfig);
      } catch (error) {
        console.error('Lỗi khi khôi phục cấu hình sort:', error);
      }
    }
  }, []);

  // Lưu cấu hình sort vào localStorage khi thay đổi
  useEffect(() => {
    if (sortConfig) {
      localStorage.setItem('volumeTableSortConfig', JSON.stringify(sortConfig));
    }
  }, [sortConfig]);

  // Xử lý hiệu ứng đổ bóng khi cuộn
  const handleScroll = () => {
    if (bodyRef.current) {
      setIsScrolled(bodyRef.current.scrollTop > 0);
    }
  };

  useEffect(() => {
    const bodyElement = bodyRef.current;
    if (bodyElement) {
      bodyElement.addEventListener('scroll', handleScroll);
      return () => {
        bodyElement.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);

  // Hàm tạo liên kết đến trang Binance trading
  const getBinanceTradeLink = (symbol: string): string => {
    try {
      // Ví dụ: BTC/USDT -> BTC_USDT
      const formattedSymbol = symbol.replace('/', '_').replace('-', '_');
      return `https://www.binance.com/vi/trade/${formattedSymbol}?type=spot`;
    } catch (error) {
      console.error('Lỗi khi tạo liên kết Binance:', error);
      return 'https://www.binance.com/vi/trade';
    }
  };

  // Hàm an toàn để định dạng số với toFixed
  const safeToFixed = (value: number | string | null | undefined, digits: number = 2): string => {
    // Kiểm tra nếu giá trị là null, undefined hoặc không phải số
    if (value === null || value === undefined || isNaN(Number(value))) {
      return '--';
    }
    
    try {
      // Parse số và giữ số chữ số thập phân tối đa
      const num = Number(value);
      
      // Nếu digits = 0, trả về số nguyên
      if (digits === 0) {
        return num.toFixed(0);
      }
      
      // Định dạng với số chữ số thập phân yêu cầu
      const formatted = num.toFixed(digits);
      
      // Loại bỏ các số 0 thừa ở cuối
      return formatted.replace(/\.?0+$/, '');
    } catch {
      return '--';
    }
  };

  // Hàm định dạng volume theo dạng viết tắt (K, M, B)
  const formatVolume = (value: number | string | null | undefined): string => {
    if (value === null || value === undefined || isNaN(Number(value))) {
      return '--';
    }
    
    try {
      const num = Number(value);
      
      if (num >= 1000000000) {
        // Tỷ (Billion)
        return safeToFixed(num / 1000000000, 2) + 'B';
      } else if (num >= 1000000) {
        // Triệu (Million)
        return safeToFixed(num / 1000000, 2) + 'M';
      } else if (num >= 1000) {
        // Nghìn (Thousand)
        return safeToFixed(num / 1000, 2) + 'K';
      } else {
        // Số nhỏ
        return safeToFixed(num, 2);
      }
    } catch {
      return '--';
    }
  };

  // Hàm kiểm tra và trả về giá trị an toàn cho phần changes
  const safeGetChangePercent = (data: CoinData, type: 'price' | 'volume'): number => {
    try {
      if (!data.changes) return 0;
      if (!data.changes[type]) return 0;
      if (data.changes[type].percent === undefined || data.changes[type].percent === null) return 0;
      return data.changes[type].percent;
    } catch (error) {
      console.error(`Lỗi khi lấy dữ liệu thay đổi ${type}:`, error);
      return 0;
    }
  };

  // Hàm xử lý sort
  const handleSort = (field: SortableField) => {
    let direction: SortDirection = 'desc'; // Mặc định giảm dần
    
    if (sortConfig && sortConfig.field === field) {
      // Nếu đang sort trên cùng field, đảo chiều sort
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    setSortConfig({ field, direction });
  };

  // Hàm lấy dữ liệu theo field để sort (với xử lý lỗi)
  const getFieldValue = (data: CoinData, field: SortableField): number => {
    try {
      switch (field) {
        case 'price':
          return data.currentPrice || 0;
        case 'priceChange':
          return safeGetChangePercent(data, 'price');
        case 'volume':
          return data.currentVolume || 0;
        case 'volumeChange':
          return safeGetChangePercent(data, 'volume');
        default:
          return 0;
      }
    } catch (error) {
      console.error('Lỗi khi lấy giá trị để sắp xếp:', error);
      return 0;
    }
  };

  // Hàm sort dữ liệu
  const sortedAlerts = (): [string, CoinData][] => {
    try {
      const alertsArray = Array.from(alerts.entries());
      
      if (sortConfig) {
        return alertsArray.sort((a, b) => {
          const aValue = getFieldValue(a[1], sortConfig.field);
          const bValue = getFieldValue(b[1], sortConfig.field);
          
          if (sortConfig.direction === 'asc') {
            return aValue - bValue;
          } else {
            return bValue - aValue;
          }
        });
      }
      
      // Mặc định sort theo thời gian
      return alertsArray.sort((a, b) => {
        const timeA = a[1].timestamp || 0;
        const timeB = b[1].timestamp || 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error('Lỗi khi sắp xếp dữ liệu:', error);
      return Array.from(alerts.entries());
    }
  };

  // Định nghĩa độ rộng cố định cho các cột
  const columnWidths = {
    logo: "w-[50px]",
    symbol: "w-[100px]",
    fullName: "w-[150px]",
    price: "w-[150px]",
    priceChange: "w-[130px]",
    volume: "w-[150px]",
    volumeChange: "w-[120px]",
    action: "w-[80px]",
  };

  // Component hiển thị icon sort
  const SortIcon = ({ field }: { field: SortableField }) => {
    if (!sortConfig || sortConfig.field !== field) {
      return (
        <span className="ml-1 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }

    if (sortConfig.direction === 'asc') {
      return (
        <span className="ml-1 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </span>
      );
    } else {
      return (
        <span className="ml-1 text-blue-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      );
    }
  };

  return (
    <div className="overflow-hidden mt-5 border rounded-lg bg-white">
      {/* Header cố định */}
      <div className={`bg-gray-50 sticky top-0 z-10 transition-shadow ${isScrolled ? 'shadow-md' : ''}`}>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`p-3 text-left border-b ${columnWidths.logo}`}></th>
              <th className={`p-3 text-left border-b ${columnWidths.symbol}`}>Coin</th>
              <th className={`p-3 text-left border-b ${columnWidths.fullName}`}>Name</th>
              <th className={`p-3 text-left border-b ${columnWidths.price} cursor-pointer hover:bg-gray-100`} 
                  onClick={() => handleSort('price')}>
                Price
                <SortIcon field="price" />
              </th>
              <th className={`p-3 text-left border-b ${columnWidths.priceChange} cursor-pointer hover:bg-gray-100`} 
                  onClick={() => handleSort('priceChange')}>
                Price Change
                <SortIcon field="priceChange" />
              </th>
              <th className={`p-3 text-left border-b ${columnWidths.volume} cursor-pointer hover:bg-gray-100`} 
                  onClick={() => handleSort('volume')}>
                Vol
                <SortIcon field="volume" />
              </th>
              <th className={`p-3 text-left border-b ${columnWidths.volumeChange} cursor-pointer hover:bg-gray-100`} 
                  onClick={() => handleSort('volumeChange')}>
                Vol Change
                <SortIcon field="volumeChange" />
              </th>
              <th className={`p-3 text-center border-b ${columnWidths.action}`}>Action</th>
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Body có thể cuộn */}
      <div 
        ref={bodyRef}
        className="max-h-[calc(100vh-320px)] overflow-y-auto"
      >
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {sortedAlerts().map(([symbol, data]) => {
              const priceChangePercent = safeGetChangePercent(data, 'price');
              const volumeChangePercent = safeGetChangePercent(data, 'volume');
              // Chuyển đổi phần trăm thành số lần
              const volumeChangeTimes = volumeChangePercent / 100;
              
              return (
                <tr key={symbol} className="hover:bg-gray-50">
                  <td className={`p-3 ${columnWidths.logo}`}>
                    {data.logoUrl ? (
                      <div className="flex items-center justify-center h-8 w-8">
                        <Image 
                          src={data.logoUrl} 
                          alt={data.baseAsset || symbol} 
                          width={32} 
                          height={32} 
                          className="rounded-full"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-600 text-xs font-bold">
                        {data.baseAsset ? data.baseAsset.substring(0, 2) : symbol.substring(0, 2)}
                      </div>
                    )}
                  </td>
                  <td className={`p-3 font-semibold ${columnWidths.symbol}`}>
                    {data.baseAsset}
                  </td>
                  <td className={`p-3 text-gray-600 ${columnWidths.fullName}`}>
                    {data.fullName || data.baseAsset || '--'}
                  </td>
                  <td className={`p-3 ${columnWidths.price}`}>
                    {safeToFixed(data.currentPrice, 8)}
                  </td>
                  <td className={`p-3 ${columnWidths.priceChange} ${priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {priceChangePercent >= 0 ? '+' : ''}
                    {safeToFixed(priceChangePercent)}%
                  </td>
                  <td className={`p-3 ${columnWidths.volume}`}>
                    {formatVolume(data.currentVolume)}
                  </td>
                  <td className={`p-3 ${columnWidths.volumeChange} ${volumeChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {volumeChangePercent >= 0 ? '+' : ''}
                    {safeToFixed(volumeChangeTimes, 2)}x
                  </td>
                  <td className={`p-3 text-center ${columnWidths.action}`}>
                    <a 
                      href={getBinanceTradeLink(symbol)} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center rounded-md bg-[#f0b90b] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#e0aa0b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>View</span>
                    </a>
                  </td>
                </tr>
              );
            })}
            
            {sortedAlerts().length === 0 && (
              <tr>
                <td colSpan={8} className="p-5 text-center text-gray-500">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 