import { Modal } from './Modal.js'
import type { AttachmentInfo, JotLocale } from './types.js'

export function AttachmentPreview({ attachment, onClose, locale = 'zh' }: {
  attachment: AttachmentInfo; onClose: () => void; locale?: JotLocale
}) {
  const en = locale === 'en'
  return <Modal title={attachment.name} onClose={onClose} closeLabel={en ? 'Close' : '关闭'}
    footer={<a className="jot-btn" href={attachment.downloadUrl} download>{en ? 'Download file' : '下载文件'}</a>}>
    <div className="jot-attachment-preview">
      {attachment.kind === 'image' ? <img className="jot-attachment-preview-image" src={attachment.url} alt={attachment.name} />
        : attachment.kind === 'pdf' ? <iframe className="jot-attachment-preview-pdf" src={attachment.url} title={attachment.name} />
          : <p>{en ? 'Preview is unavailable for this file type. Download it to open.' : '此文件类型暂不提供预览，下载后可以打开。'}</p>}
      <p className="jot-file-details">{attachment.mimeType} · {(attachment.size / 1024).toFixed(1)} KB</p>
    </div>
  </Modal>
}
