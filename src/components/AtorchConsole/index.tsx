import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Button, Col, Container, Row } from 'reactstrap';
import { clearStore, connect, downloadCSV } from '../../actions/atorch';
import locals from './index.scss';
import { PrintReport } from './PrintReport';

export const AtorchConsole: React.FC = () => {
  const dispatch = useDispatch();
  const connected = useSelector((state) => state.report.connected);
  const latest = useSelector((state) => state.report.latest);
  const onConnect = () => dispatch(connect());
  const onDownloadCSV = () => dispatch(downloadCSV());
  const onDBReset = () => dispatch(clearStore());
  return (
    <Container className={locals.container}>
      <Row className='ml-2 justify-content-center'>
        <Button outline onClick={onConnect}>
          {connected ? 'Disconnect' : 'Connect'}
        </Button>
      </Row>
      <PrintReport packet={latest} />
      <Row className='mt-2'>
        <Col>
          <Button onClick={onDownloadCSV}>
            ダウンロード
          </Button>
          <div className='mt-2'>
            これまでにブラウザに貯められたログを全部CSVに書き出す
          </div>
        </Col>
        <Col>
          <Button onClick={onDBReset}>
            DBリセット
          </Button>
          <div className='mt-2'>
            これまでにブラウザに貯められたログを消す
          </div>
        </Col>
      </Row>
    </Container>
  );
};
