import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Smartphone,
  Laptop,
  Speaker,
  Tv,
  Headphones,
  Cast,
  Check,
  Wifi,
} from "lucide-react";

interface DeviceConnectProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Device {
  id: string;
  name: string;
  type: "phone" | "laptop" | "speaker" | "tv" | "headphones";
  isActive: boolean;
  isAvailable: boolean;
}

const mockDevices: Device[] = [
  {
    id: "1",
    name: "This iPhone",
    type: "phone",
    isActive: true,
    isAvailable: true,
  },
  {
    id: "2",
    name: "MacBook Pro",
    type: "laptop",
    isActive: false,
    isAvailable: true,
  },
  {
    id: "3",
    name: "Living Room Speaker",
    type: "speaker",
    isActive: false,
    isAvailable: true,
  },
  {
    id: "4",
    name: "Samsung TV",
    type: "tv",
    isActive: false,
    isAvailable: false,
  },
  {
    id: "5",
    name: "AirPods Pro",
    type: "headphones",
    isActive: false,
    isAvailable: true,
  },
];

const deviceIcons = {
  phone: Smartphone,
  laptop: Laptop,
  speaker: Speaker,
  tv: Tv,
  headphones: Headphones,
};

export function DeviceConnect({ isOpen, onClose }: DeviceConnectProps) {
  const [devices, setDevices] = useState<Device[]>(mockDevices);
  const [isScanning, setIsScanning] = useState(false);

  const handleDeviceSelect = (deviceId: string) => {
    setDevices(
      devices.map((d) => ({
        ...d,
        isActive: d.id === deviceId,
      }))
    );
  };

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 2000);
  };

  const activeDevice = devices.find((d) => d.isActive);
  const availableDevices = devices.filter((d) => !d.isActive && d.isAvailable);
  const unavailableDevices = devices.filter((d) => !d.isAvailable);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-background p-6"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-muted" />

            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/20 p-3">
                  <Cast className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Connect to a device
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Select a device to play on
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground hover:bg-white/10"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Current Device */}
            {activeDevice && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Current Device
                </h3>
                <div className="flex items-center gap-4 rounded-xl bg-primary/20 p-4">
                  <div className="rounded-full bg-primary/30 p-3">
                    {(() => {
                      const Icon = deviceIcons[activeDevice.type];
                      return <Icon className="h-6 w-6 text-primary" />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">
                      {activeDevice.name}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-3 w-1 rounded-full bg-primary"
                            animate={{ scaleY: [0.4, 1, 0.4] }}
                            transition={{
                              duration: 0.6,
                              repeat: Infinity,
                              delay: i * 0.15,
                            }}
                          />
                        ))}
                      </div>
                      <span className="text-sm text-primary">Playing</span>
                    </div>
                  </div>
                  <Check className="h-6 w-6 text-primary" />
                </div>
              </div>
            )}

            {/* Available Devices */}
            {availableDevices.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Available Devices
                </h3>
                <div className="space-y-2">
                  {availableDevices.map((device) => {
                    const Icon = deviceIcons[device.type];
                    return (
                      <button
                        key={device.id}
                        onClick={() => handleDeviceSelect(device.id)}
                        className="flex w-full items-center gap-4 rounded-xl bg-white/5 p-4 transition-colors hover:bg-white/10"
                      >
                        <div className="rounded-full bg-white/10 p-3">
                          <Icon className="h-6 w-6 text-foreground" />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="font-medium text-foreground">
                            {device.name}
                          </p>
                          <div className="flex items-center gap-1 text-sm text-primary">
                            <Wifi className="h-3 w-3" />
                            <span>Available</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unavailable Devices */}
            {unavailableDevices.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Unavailable
                </h3>
                <div className="space-y-2 opacity-50">
                  {unavailableDevices.map((device) => {
                    const Icon = deviceIcons[device.type];
                    return (
                      <div
                        key={device.id}
                        className="flex items-center gap-4 rounded-xl bg-white/5 p-4"
                      >
                        <div className="rounded-full bg-white/10 p-3">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-muted-foreground">
                            {device.name}
                          </p>
                          <span className="text-sm text-muted-foreground">
                            Offline
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scan Button */}
            <button
              onClick={handleScan}
              disabled={isScanning}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 p-4 font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Wifi className="h-5 w-5" />
                  </motion.div>
                  <span>Scanning for devices...</span>
                </>
              ) : (
                <>
                  <Wifi className="h-5 w-5" />
                  <span>Scan for devices</span>
                </>
              )}
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
