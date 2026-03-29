import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, buildTransactionPath, formatDate, truncateHash } from "../api/client";

function renderValue(value) {
  if (value == null || value === "") {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

export default function TransactionDetailPage() {
  const { txHash = "" } = useParams();
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setDetail(null);

    apiFetch(`/api/chain/tx/${txHash}`)
      .then(setDetail)
      .catch((err) => setError(err.message));
  }, [txHash]);

  return (
    <div className="page-grid">
      <section className="panel">
        <div className="section-head">
          <h3>交易详情</h3>
          <p>查看交易基础信息、回执、区块信息和关联业务记录。</p>
        </div>

        {error ? <div className="alert error">{error}</div> : null}

        {detail ? (
          <>
            <div className="network-banner">
              <span>网络：{detail.chainName}</span>
              <span>模式：{detail.chainMode}</span>
              <span>Chain ID：{detail.chainId}</span>
            </div>

            <div className="info-grid">
              <div>
                <span>交易哈希</span>
                <strong className="hash-wrap">{detail.txHash}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{detail.receipt?.status || detail.relatedRecord?.status || "未知"}</strong>
              </div>
              <div>
                <span>区块号</span>
                <strong>{detail.receipt?.blockNumber ?? detail.transaction?.blockNumber ?? "-"}</strong>
              </div>
              <div>
                <span>日志数量</span>
                <strong>{detail.receipt?.logs?.length ?? 0}</strong>
              </div>
            </div>

            {detail.relatedRecord ? (
              <section className="tx-section">
                <div className="section-head">
                  <h3>关联业务</h3>
                  <p>数据库中与这笔交易绑定的业务记录。</p>
                </div>
                <div className="record-item stacked-item">
                  <div>
                    <strong>
                      {detail.relatedRecord.business_type} #{detail.relatedRecord.business_id}
                    </strong>
                    <p>记录状态 {detail.relatedRecord.status}</p>
                    <p>生成时间 {formatDate(detail.relatedRecord.created_at)}</p>
                  </div>
                  <div className="code-block">
                    <pre>{renderValue(JSON.parse(detail.relatedRecord.payload_json || "{}"))}</pre>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="tx-section">
              <div className="section-head">
                <h3>交易概览</h3>
                <p>来源地址、目标地址、Gas 和输入数据。</p>
              </div>
              <div className="detail-table">
                <div><span>From</span><strong className="hash-wrap">{detail.transaction?.from || detail.receipt?.from || "-"}</strong></div>
                <div><span>To</span><strong className="hash-wrap">{detail.transaction?.to || detail.receipt?.to || "-"}</strong></div>
                <div><span>Nonce</span><strong>{detail.transaction?.nonce ?? "-"}</strong></div>
                <div><span>Type</span><strong>{detail.transaction?.type ?? "-"}</strong></div>
                <div><span>Value (wei)</span><strong>{detail.transaction?.value ?? "-"}</strong></div>
                <div><span>Gas Limit</span><strong>{detail.transaction?.gasLimit ?? "-"}</strong></div>
                <div><span>Gas Used</span><strong>{detail.receipt?.gasUsed ?? "-"}</strong></div>
                <div><span>Effective Gas Price</span><strong>{detail.receipt?.effectiveGasPrice ?? detail.transaction?.gasPrice ?? "-"}</strong></div>
              </div>
              <div className="code-block">
                <p>Input Data</p>
                <pre>{renderValue(detail.transaction?.data)}</pre>
              </div>
            </section>

            {detail.block ? (
              <section className="tx-section">
                <div className="section-head">
                  <h3>区块信息</h3>
                  <p>交易打包所在区块。</p>
                </div>
                <div className="detail-table">
                  <div><span>区块号</span><strong>{detail.block.number}</strong></div>
                  <div><span>区块时间</span><strong>{formatDate(detail.block.timestampIso)}</strong></div>
                  <div><span>Miner</span><strong className="hash-wrap">{detail.block.miner}</strong></div>
                  <div><span>Gas Used</span><strong>{detail.block.gasUsed}</strong></div>
                </div>
                <div className="code-block">
                  <p>Block Hash</p>
                  <pre>{detail.block.hash}</pre>
                </div>
              </section>
            ) : null}

            {detail.receipt?.logs?.length ? (
              <section className="tx-section">
                <div className="section-head">
                  <h3>事件日志</h3>
                  <p>合约事件原始日志。</p>
                </div>
                <div className="record-list">
                  {detail.receipt.logs.map((log, index) => (
                    <div className="record-item stacked-item" key={`${log.transactionHash}-${index}`}>
                      <div>
                        <strong>Log #{index}</strong>
                        <p className="hash-wrap">{log.address}</p>
                      </div>
                      <div className="code-block">
                        <pre>{renderValue(log)}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="button-row">
              <Link className="ghost-button" to={buildTransactionPath(detail.txHash)}>
                刷新当前页
              </Link>
              {detail.explorerTxUrl ? (
                <a className="ghost-button" href={detail.explorerTxUrl} target="_blank" rel="noreferrer">
                  在区块浏览器查看
                </a>
              ) : null}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
