'use client';

import { useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { CoinData } from '../types';

type VolumeTableProps = {
  alerts: Map<string, CoinData>;
};

// Các trường có thể sort
type SortableField = keyof CoinData | 'priceChange' | 'volumeChange' | 'volMarketCapRatio' | 'volAvg10day' | 'volRatioToAvg';
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
    if (value === null || value === undefined || isNaN(Number(value))) {
      return '--';
    }
    
    try {
      const num = Number(value);
      if (digits === 0) {
        return num.toFixed(0);
      }
      const formatted = num.toFixed(digits);
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
        return safeToFixed(num / 1000000000, 2) + 'B';
      } else if (num >= 1000000) {
        return safeToFixed(num / 1000000, 2) + 'M';
      } else if (num >= 1000) {
        return safeToFixed(num / 1000, 2) + 'K';
      } else {
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
    let direction: SortDirection = 'desc';
    
    if (sortConfig && sortConfig.field === field) {
      direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    }
    
    setSortConfig({ field, direction });
  };

  // Hàm lấy dữ liệu theo field để sort
  const getFieldValue = (data: CoinData, field: SortableField): number => {
    try {
      switch (field) {
        case 'currentPrice':
          return data.currentPrice || 0;
        case 'currentVolume':
          return data.currentVolume || 0;
        case 'marketCap':
          return data.marketCap || 0;
        case 'priceChange':
          return safeGetChangePercent(data, 'price');
        case 'volumeChange':
          return safeGetChangePercent(data, 'volume');
        case 'volMarketCapRatio':
          return data.marketCap ? (data.currentVolume / data.marketCap) * 100 : 0;
        case 'volAvg10day':
          return data.totalVolume ? data.totalVolume.value / ((data.totalVolume.endTime - data.totalVolume.startTime) / 1000 / 180) : 0;
        case 'volRatioToAvg':
          const avgVol = data.totalVolume ? data.totalVolume.value / ((data.totalVolume.endTime - data.totalVolume.startTime) / 1000 / 180) : 0;
          return avgVol ? data.currentVolume / avgVol : 0;
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
    coinInfo: "w-[120px]",
    price: "w-[120px]",
    priceChange: "w-[120px]",
    volume: "w-[100px]",
    volumeChange: "w-[120px]",
    volMarketCapRatio: "w-[120px]",
    volAvg10day: "w-[120px]",
    volRatioToAvg: "w-[120px]",
    action: "w-[80px]",
    marketCap: "w-[120px]",
  };

  // Component hiển thị icon sort
  const SortIcon = ({ field }: { field: SortableField }) => {
    if (!sortConfig || sortConfig.field !== field) {
      return (
        <span className="ml-1 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </span>
      );
    }

    if (sortConfig.direction === 'asc') {
      return (
        <span className="ml-1 text-blue-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </span>
      );
    } else {
      return (
        <span className="ml-1 text-blue-600">
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
      <div className={`bg-gray-100 sticky top-0 z-10 transition-shadow ${isScrolled ? 'shadow-md' : ''}`}>
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`p-3 text-left border-b border-gray-200 ${columnWidths.logo}`}></th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.coinInfo}`}>Coin</th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.marketCap} cursor-pointer hover:bg-gray-200`} 
                  onClick={() => handleSort('marketCap')}>
                MCap
                <SortIcon field="marketCap" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.price} cursor-pointer hover:bg-gray-200`} 
                  onClick={() => handleSort('currentPrice')}>
                Price
                <SortIcon field="currentPrice" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.priceChange} cursor-pointer hover:bg-gray-200`} 
                  onClick={() => handleSort('priceChange')}>
                P Change
                <SortIcon field="priceChange" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.volume} cursor-pointer hover:bg-gray-200`} 
                  onClick={() => handleSort('currentVolume')}>
                Vol
                <SortIcon field="currentVolume" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.volumeChange} cursor-pointer hover:bg-gray-200`}
                  onClick={() => handleSort('volumeChange')}>
                V Change
                <SortIcon field="volumeChange" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.volMarketCapRatio} cursor-pointer hover:bg-gray-200`}
                  onClick={() => handleSort('volMarketCapRatio')}>
                V/MCap
                <SortIcon field="volMarketCapRatio" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.volAvg10day} cursor-pointer hover:bg-gray-200`}
                  onClick={() => handleSort('volAvg10day')}>
                VAVG
                <SortIcon field="volAvg10day" />
              </th>
              <th className={`p-3 text-left border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.volRatioToAvg} cursor-pointer hover:bg-gray-200`}
                  onClick={() => handleSort('volRatioToAvg')}>
                V/VAVG
                <SortIcon field="volRatioToAvg" />
              </th>
              <th className={`p-3 text-center border-b border-gray-200 font-semibold text-gray-800 ${columnWidths.action}`}>Action</th>
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
              const volumeChangeTimes = volumeChangePercent / 100;
              const volAvg10day = data.totalVolume ? data.totalVolume.value / ((data.totalVolume.endTime - data.totalVolume.startTime) / 1000 / 180) : 0;
              const volRatioToAvg = volAvg10day ? data.currentVolume / volAvg10day : 0;
              
              return (
                <tr key={symbol} className="hover:bg-gray-100">
                  <td className={`p-3 border-b border-gray-200 ${columnWidths.logo}`}>
                    {data.logoUrl ? (
                      <div className="flex items-center justify-center h-8 w-8">
                        <Image 
                          src={data.logoUrl} 
                          alt=""
                          width={32} 
                          height={32} 
                          className="rounded-full"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-gray-200 text-gray-700 text-xs font-bold">
                        {data.baseAsset ? data.baseAsset.substring(0, 2) : symbol.substring(0, 2)}
                      </div>
                    )}
                  </td>
                  <td className={`p-3 border-b border-gray-200 ${columnWidths.coinInfo}`}>
                    <div className="flex flex-col">
                      <span className="font-semibold text-gray-800">{data.baseAsset}</span>
                      <span className="text-xs text-gray-500">{data.fullName || data.baseAsset || '--'}</span>
                    </div>
                  </td>
                  <td className={`p-3 border-b border-gray-200 text-gray-700 ${columnWidths.marketCap}`}>
                    {formatVolume(data.marketCap)}
                  </td>
                  <td className={`p-3 border-b border-gray-200 text-gray-700 ${columnWidths.price}`}>
                    {safeToFixed(data.currentPrice, 8)}
                  </td>
                  <td className={`p-3 border-b border-gray-200 ${columnWidths.priceChange} ${priceChangePercent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {priceChangePercent >= 0 ? '+' : ''}
                    {safeToFixed(priceChangePercent)}%
                  </td>
                  <td className={`p-3 border-b border-gray-200 text-gray-700 ${columnWidths.volume}`}>
                    {formatVolume(data.currentVolume)}
                  </td>
                  <td className={`p-3 border-b border-gray-200 ${columnWidths.volumeChange} ${volumeChangePercent >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {volumeChangePercent >= 0 ? '+' : ''}
                    {safeToFixed(volumeChangeTimes, 2)}x
                  </td>
                  <td className={`p-3 border-b border-gray-200 text-gray-700 ${columnWidths.volMarketCapRatio}`}>
                    {safeToFixed((data.currentVolume / data.marketCap) * 100, 2)}%
                  </td>
                  <td className={`p-3 border-b border-gray-200 text-gray-700 ${columnWidths.volAvg10day}`}>
                    {formatVolume(volAvg10day)}
                  </td>
                  <td className={`p-3 border-b border-gray-200  text-green-700 ${columnWidths.volRatioToAvg}`}>
                    {safeToFixed(volRatioToAvg, 2)}x
                  </td>
                  <td className={`p-3 text-center border-b border-gray-200 ${columnWidths.action}`}>
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
                <td colSpan={12} className="p-5 text-center text-gray-700">
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