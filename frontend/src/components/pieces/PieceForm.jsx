import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emptyPiece, pieceOptions } from '../../data/options.js';
import { piecesService } from '../../services/piecesService.js';
import { validatePiece } from '../../services/validation.js';
import { useFeedback } from '../../context/FeedbackContext.jsx';
import FloatingInput from '../common/FloatingInput.jsx';
import SelectField from '../common/SelectField.jsx';
import Button from '../common/Button.jsx';
import ImageUpload from '../common/ImageUpload.jsx';
import ConfirmModal from '../common/ConfirmModal.jsx';
import PieceImage from './PieceImage.jsx';

export default function PieceForm({ piece }) {
  const [values, setValues] = useState(() => piece ? { ...piece } : emptyPiece());
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  const notify = useFeedback();
  const set = (key, value) => { setValues((previous) => ({ ...previous, [key]: value })); setErrors((previous) => ({ ...previous, [key]: undefined, form: undefined })); };
  const submit = async (event) => {
    event.preventDefault();
    const validation = validatePiece(values);
    setErrors(validation);
    if (Object.keys(validation).length) { requestAnimationFrame(() => event.target.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setBusy(true);
    try {
      if (piece) await piecesService.update(piece.id, values);
      else await piecesService.create(values);
      notify(piece ? 'Alterações salvas.' : 'Peça adicionada ao closet.');
      navigate('/pieces');
    } catch (error) { setErrors(error.fields || { form: error.message }); setBusy(false); }
  };
  return <>
    <form className="piece-form" onSubmit={submit} noValidate>
      <div className="piece-upload-wrap">
        <ImageUpload label="Selecionar foto da peça (opcional)" onChange={(url) => { set('image', url); set('imageKey', ''); }}>
          <PieceImage piece={values} />
          <span className="upload-plus" aria-hidden="true">+</span>
        </ImageUpload>
        {(values.image || values.imageKey) && <button className="text-link remove-image" type="button" onClick={() => setValues({ ...values, image: '', imageKey: '' })}>Remover imagem</button>}
      </div>
      <div className="narrow-content">
        <FloatingInput label="Nome da Peça" name="name" value={values.name} error={errors.name} maxLength={100} onChange={(event) => set('name', event.target.value)} required />
        <div className="select-grid">
          {Object.entries(pieceOptions).map(([key, option]) => <SelectField key={key} label={option.label} options={option.values} value={values[key]} error={errors[key]} required
            onChange={(event) => set(key, event.target.value)} />)}
        </div>
        {errors.form && <p className="form-error" role="alert">{errors.form}</p>}
        <div className="piece-form-actions">
          <Button type="submit" disabled={busy}>{piece ? 'Salvar Alterações' : 'Salvar Peça'}</Button>
          {piece && <Button onClick={() => setConfirm(true)}>Excluir Peça</Button>}
        </div>
      </div>
    </form>
    {confirm && <ConfirmModal description={`Excluir ${piece.name}? A peça também será removida dos conjuntos.`} onClose={() => setConfirm(false)} onConfirm={async () => {
      await piecesService.remove(piece.id); notify('Peça excluída.'); navigate('/pieces');
    }} />}
  </>;
}
