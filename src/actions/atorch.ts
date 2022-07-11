import actionCreatorFactory from 'typescript-fsa';
import { asyncFactory } from 'typescript-fsa-redux-thunk';
import { AtorchService } from '../service/atorch-service';
import { DCMeterPacket, PacketType, readPacket } from '../service/atorch-packet';

const create = actionCreatorFactory('ATORCH');
const createAsync = asyncFactory(create);

const DB_LABEL = 'atorch_log';
const STORE_LABEL = 'dc_meter_values';

interface ExtendedDCMeterPacket extends DCMeterPacket {
  timestamp: number;
}

let db: IDBDatabase | null = null;
const request = window.indexedDB.open(DB_LABEL, 1);

request.onupgradeneeded = function (event) {
  db = (<IDBRequest>event.target).result;
  if (!db) {
    return;
  }
  db.createObjectStore(STORE_LABEL, { keyPath: 'timestamp' });
};

request.onsuccess = function (event) {
  db = (<IDBRequest>event.target).result;
};

request.onerror = function (event) {
  console.error(event);
}

export const setConnected = create<boolean>('SET_CONNECTED');
export const updatePacket = create<PacketType>('UPDATE_PACKET');

export const connect = createAsync('CONNECT', async (params, dispatch) => {
  const device = await AtorchService.requestDevice();
  dispatch(setConnected(true));
  device.on('disconnected', () => {
    dispatch(setConnected(false));
  });
  device.on('packet', (packet) => {
    insertToDB(packet);
    dispatch(updatePacket(packet));
  });
  await device.connect();
  return device;
});

export const disconnect = createAsync('DISCONNECT', async (params, dispatch, getState) => {
  const { atorch } = getState();
  return atorch?.disconnect();
});

export const sendCommand = createAsync('SEND_COMMAND', async (block: Buffer | undefined, dispatch, getState) => {
  if (block === undefined) {
    return;
  }
  const { atorch } = getState();
  return atorch?.sendCommand(block);
});

export const downloadCSV = createAsync('DOWNLOAD_CSV', async () => {
  /*
   * Unix timestamp -> 'YY-MM-DD HH:mm:ss'
   */
  const formatDate = (d: number) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
  };
  try {
    const data = await getAllStoreData();
    if (data === null) {
      return Promise.reject('data was null');
    }

    // sort -> csv format -> join
    const str = data
    .sort((a,b) => a.timestamp - b.timestamp)
    .map((d) => {
      return `${formatDate(d.timestamp)},${d.mVoltage},${d.mAmpere},${d.mWh},${d.mWatt},${d.fee},${d.temperature},${d.duration}`;
    })
    .join('\n');

     const headerStr = 'timestamp,mVoltage,mAmpere,mWh,mWatt,fee,temperature,duration\n';

    // download
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([headerStr, str], { type: 'text/csv' }));
    a.download = `${STORE_LABEL}.csv`;
    a.click();
  } catch (err) {
    console.log('[downloadCSV] getAllStoreData() failed', err);
  }
  return;
});

export const clearStore = createAsync('CLEAR_STORE', async () => {
  if (confirm('データベースを空にしてもいいですか？')) {
    if (!db) return;
    const transaction = db.transaction(STORE_LABEL, 'readwrite');
    transaction.onerror = function (event) {
      console.error('[clearStore] transaction failed', event);
    };
    const clearReq = transaction.objectStore(STORE_LABEL).clear();
    clearReq.onsuccess = function (_event) {
      alert('データベースを空にしました');
    };
    clearReq.onerror = function (event) {
      alert(`データベースを空にできませんでした ${event}`);
    };
  }
});

const getAllStoreData = () => {
  if (!db) return null;
  const transaction = db.transaction(STORE_LABEL, 'readonly');
  transaction.onerror = function (event) {
    console.error('[getAllStoreData] transaction failed', event);
  };
  const pendingGetAll = transaction.objectStore(STORE_LABEL).getAll();
  return new Promise<Array<ExtendedDCMeterPacket>>((resolve, reject) => {
    pendingGetAll.onsuccess = function (event) {
      if (event.target instanceof IDBRequest) {
        const result = event.target.result;
        if (Array.isArray(result)) {
          resolve(result);
        } else {
          reject(new Error(`event was unexpected object: ${event.target}`));
        }
      } else {
        reject(new Error('something wrong'));
      }
    };
    pendingGetAll.onerror = function (event) {
      reject(event);
    };
  });
}

const insertToDB = (packet: ReturnType<typeof readPacket>) => {
  if (!db) return;
  const transaction = db.transaction(STORE_LABEL, 'readwrite');
  transaction.onerror = function (event) {
    console.error('[insertToDB] transaction failed', event);
  };
  const store = transaction.objectStore(STORE_LABEL);

  // packet: DCMeterPacket, key: Unix time
  const addRequest = store.add({...packet, timestamp: Date.now()});
  addRequest.onsuccess = function (_event) {
    //console.log(`[insertToDB] put value to ${DB_LABEL}.${STORE_LABEL}`);
  };
  addRequest.onerror = function (event) {
    console.error('[insertToDB] error occured on putting, msg', event);
  };
}
