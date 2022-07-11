import actionCreatorFactory from 'typescript-fsa';
import { asyncFactory } from 'typescript-fsa-redux-thunk';
import { AtorchService } from '../service/atorch-service';
import { PacketType, readPacket } from '../service/atorch-packet';

const create = actionCreatorFactory('ATORCH');
const createAsync = asyncFactory(create);

const DB_LABEL = 'atorch_log';
const STORE_LABEL = 'dc_meter_values';

let db: IDBDatabase | null = null;
const request = window.indexedDB.open(DB_LABEL, 1);

request.onupgradeneeded = function (event) {
  db = (<IDBRequest>event.target).result;
  if (!db) {
    return;
  }
  const store = db.createObjectStore(STORE_LABEL);
};

request.onsuccess = function (event) {
  db = (<IDBRequest>event.target).result;
};

request.onerror = function (event) {
  console.error((<any>event).message);
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

const insertToDB = (packet: ReturnType<typeof readPacket>) => {
  if (!db) return;
  const transaction = db.transaction(STORE_LABEL, 'readwrite');
  transaction.oncomplete = function (_event) {
    //console.log('[insertToDB] transaction saved');
  };
  transaction.onerror = function (event) {
    console.error(`[insertToDB] transaction failed ${(<any>event).message}`);
  };
  const store = transaction.objectStore(STORE_LABEL);

  // packet: DCMeterPacket, key: Unix time
  const addRequest = store.add(packet, Date.now());
  addRequest.onsuccess = function (_event) {
    //console.log(`[insertToDB] put value to ${DB_LABEL}.${STORE_LABEL}`);
  };
  addRequest.onerror = function (event) {
    console.error(`[insertToDB] error occured on putting, msg ${(<any>event).message}`);
  };
}
