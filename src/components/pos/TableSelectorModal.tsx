"use client";

import React from "react";
import { usePOS } from "../../context/POSContext";
import { RestaurantTable } from "../../types/pos";
import { X, Users, Check, AlertCircle } from "lucide-react";

interface TableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TableSelectorModal: React.FC<TableSelectorModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tables, selectedTable, setSelectedTable, loadingTables } =
    usePOS();

  if (!isOpen) return null;

  // Group tables by floor
  const floors = Array.from(new Set(tables.map((t) => t.floor || "Main Dining")));

  const handleSelect = (table: RestaurantTable) => {
    setSelectedTable(table);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Select Dine-in Table
            </h2>
            <p className="text-xs text-slate-500">
              Choose an available table for this dining session
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-100 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Reserved / Out of Service</span>
          </div>
        </div>

        {/* Tables Grid */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadingTables ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading restaurant tables...
            </div>
          ) : tables.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No tables configured</p>
              <p className="text-xs text-slate-400 mt-1">
                Configure tables in Settings to enable Dine-in seating.
              </p>
            </div>
          ) : (
            floors.map((floor) => {
              const floorTables = tables.filter(
                (t) => (t.floor || "Main Dining") === floor
              );

              return (
                <div key={floor}>
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    {floor}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {floorTables.map((table) => {
                      const isSelected = selectedTable?._id === table._id;
                      const isOccupied = table.status === "OCCUPIED";
                      const isOutOfService =
                        table.status === "OUT_OF_SERVICE" || table.status === "RESERVED";

                      return (
                        <button
                          key={table._id}
                          disabled={isOutOfService}
                          onClick={() => handleSelect(table)}
                          className={`relative p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between h-24 ${
                            isSelected
                              ? "bg-teal-50 border-teal-600 ring-2 ring-teal-600/20 text-teal-950"
                              : isOccupied
                              ? "bg-amber-50/50 border-amber-200 text-amber-950 hover:border-amber-400"
                              : isOutOfService
                              ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                              : "bg-white border-slate-200 text-slate-900 hover:border-teal-500 hover:shadow-xs"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-extrabold text-sm">
                              Table {table.tableNumber}
                            </span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOccupied
                                  ? "bg-amber-500"
                                  : isOutOfService
                                  ? "bg-slate-400"
                                  : "bg-emerald-500"
                              }`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <div className="flex items-center gap-1">
                              <Users className="w-3 h-3 text-slate-400" />
                              <span>{table.capacity} seats</span>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-teal-600" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
