const WEBHOOK_DISPONIBILIDADE = 'https://n8n.srv1352561.hstgr.cloud/webhook/agendadisp';
const WEBHOOK_AGENDAMENTO = 'https://n8n.srv1352561.hstgr.cloud/webhook/agendaclinica';

const inputData = document.getElementById('data');
const selectHorario = document.getElementById('horario');
const inputCpf = document.getElementById('cpf');
const inputCelular = document.getElementById('celular');
const form = document.getElementById('formAgendamento');
const statusMensagem = document.getElementById('statusMensagem');
const btnSubmit = document.getElementById('btnSubmit');
const btnCancelar = document.getElementById('btnCancelar');

// Definir data mínima como hoje
const hoje = new Date().toISOString().split('T')[0];
inputData.setAttribute('min', hoje);

// Máscara de CPF (000.000.000-00)
inputCpf.addEventListener('input', (e) => {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d)/, '$1.$2');
  v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  e.target.value = v;
});

// Máscara de WhatsApp ((22) 99908-9122)
inputCelular.addEventListener('input', (e) => {
  let v = e.target.value.replace(/\D/g, '');
  if (v.length > 11) v = v.slice(0, 11);
  v = v.replace(/^(\d{2})(\d)/g, '($1) $2');
  v = v.replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  e.target.value = v;
});

// Buscar horários livres ao trocar a data
inputData.addEventListener('change', async () => {
  const dataSelecionada = inputData.value;
  ocultarMensagem();

  if (!dataSelecionada) {
    selectHorario.innerHTML = '<option value="">Selecione uma data...</option>';
    selectHorario.disabled = true;
    return;
  }

  selectHorario.disabled = true;
  selectHorario.innerHTML = '<option value="">Buscando horários...</option>';

  try {
    const response = await fetch(`${WEBHOOK_DISPONIBILIDADE}?data=${encodeURIComponent(dataSelecionada)}`);
    if (!response.ok) throw new Error('Falha ao consultar disponibilidade.');

    const resultado = await response.json();
    const dados = Array.isArray(resultado) ? resultado[0] : resultado;
    const slots = dados.slots || [];

    selectHorario.innerHTML = '';

    if (slots.length === 0) {
      const msg = dados.mensagem || 'Nenhum horário disponível nesta data';
      selectHorario.innerHTML = `<option value="">${msg}</option>`;
      selectHorario.disabled = true;
      return;
    }

    slots.forEach((slot) => {
      const option = document.createElement('option');
      option.value = slot.inicio; // Ex: 2026-11-16T14:00:00.000-03:00
      option.textContent = slot.hora; // Ex: 14:00
      option.dataset.hora = slot.hora;
      selectHorario.appendChild(option);
    });

    selectHorario.disabled = false;
  } catch (error) {
    console.error(error);
    selectHorario.innerHTML = '<option value="">Erro ao carregar horários</option>';
    selectHorario.disabled = true;
  }
});

// Enviar agendamento
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarMensagem();

  const cpfLimpo = inputCpf.value.replace(/\D/g, '');
  const celularLimpo = inputCelular.value.replace(/\D/g, '');
  const celularFormatado = celularLimpo.startsWith('55') ? `+${celularLimpo}` : `+55${celularLimpo}`;

  const inicioISO = selectHorario.value;
  const horaTexto = selectHorario.options[selectHorario.selectedIndex]?.dataset?.hora || '';

  const payload = {
    unidade: document.getElementById('unidade').value,
    especialista: document.getElementById('especialista').value,
    tipo_atendimento: document.getElementById('tipo_atendimento').value,
    nome: document.getElementById('nome').value.trim(),
    cpf: cpfLimpo,
    celular: celularFormatado,
    email: document.getElementById('email').value.trim(),
    assunto: document.getElementById('assunto').value.trim(),
    data: inputData.value,
    horario: inicioISO,
    hora_formatada: horaTexto,
    inicio: inicioISO
  };

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Agendando...';

  try {
    const response = await fetch(WEBHOOK_AGENDAMENTO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Erro ao confirmar o agendamento.');

    exibirMensagem('Agendamento realizado com sucesso! Você receberá a confirmação no WhatsApp.', 'success');
    form.reset();
    selectHorario.innerHTML = '<option value="">Selecione uma data...</option>';
    selectHorario.disabled = true;
  } catch (error) {
    console.error(error);
    exibirMensagem('Não foi possível concluir o agendamento. Tente novamente.', 'error');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Confirmar Agendamento';
  }
});

btnCancelar.addEventListener('click', () => {
  form.reset();
  selectHorario.innerHTML = '<option value="">Selecione uma data...</option>';
  selectHorario.disabled = true;
  ocultarMensagem();
});

function exibirMensagem(texto, tipo) {
  statusMensagem.textContent = texto;
  statusMensagem.className = `status-message ${tipo}`;
  statusMensagem.style.display = 'block';
}

function ocultarMensagem() {
  statusMensagem.style.display = 'none';
}
