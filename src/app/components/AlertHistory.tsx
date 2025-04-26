'use client';

import { useState } from 'react';
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

type AlertData = CoinData & {
  alertTime: number;
};

type AlertHistoryProps = {
  alerts: AlertData[];
  openTradingChart: (symbol: string) => void;
};

export default function AlertHistory({ alerts, openTradingChart }: AlertHistoryProps) {
  // Định dạng thời gian
  const formatAlertTime = (timestamp: number): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    } catch (error) {
      return '--';
    }
  };

  // Hàm an toàn để định dạng số với toFixed
  const safeToFixed = (value: any, digits: number = 2): string => {
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
    } catch (error) {
      console.error('Lỗi khi định dạng số:', error, value);
      return '--';
    }
  };

  // Hàm định dạng volume theo dạng viết tắt (K, M, B)
  const formatVolume = (value: any): string => {
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
    } catch (error) {
      console.error('Lỗi khi định dạng volume:', error, value);
      return '--';
    }
  };

  return (
    <div className="overflow-y-auto h-full">
      {alerts.length === 0 ? (
        <div className="text-center text-gray-500 italic py-4">
          <div className="flex flex-col items-center justify-center space-y-2">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-8 w-8 text-gray-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={1} 
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
              />
            </svg>
            <p>Chưa có cảnh báo</p>
          </div>
        </div>
      ) : (
        <>
          <ul className="space-y-2 pb-1">
            {alerts.map((alert, index) => (
              <li 
                key={`${alert.symbol}-${alert.alertTime}`} 
                className="border border-gray-200 rounded-lg p-2.5 bg-white hover:bg-gray-50 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center">
                    {alert.logoUrl ? (
                      <Image 
                        src={alert.logoUrl} 
                        alt={alert.symbol} 
                        width={20} 
                        height={20} 
                        className="mr-2 object-contain"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-5 w-5 rounded-full bg-gray-200 text-gray-600 text-xs font-bold mr-2">
                        {alert.baseAsset ? alert.baseAsset.substring(0, 1) : alert.symbol.substring(0, 1)}
                      </div>
                    )}
                    <span className="font-bold text-gray-800">{alert.baseAsset}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatAlertTime(alert.alertTime)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Giá: </span>
                    <span>{safeToFixed(alert.currentPrice, 8)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Thay đổi giá: </span>
                    <span className={alert.changes.price.percent >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {alert.changes.price.percent >= 0 ? '+' : ''}
                      {safeToFixed(alert.changes.price.percent)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Volume: </span>
                    <span>{formatVolume(alert.currentVolume)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Thay đổi volume: </span>
                    <span className="text-green-600">
                      +{safeToFixed(alert.changes.volume.percent / 100, 2)}x
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => openTradingChart(alert.symbol)}
                  className="mt-1.5 w-full text-xs bg-[#f0b90b] hover:bg-[#e0aa0b] text-white font-medium py-1 px-2 rounded flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Mở biểu đồ
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
} 