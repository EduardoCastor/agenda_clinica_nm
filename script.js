/* =========================================================
   CLÍNICA DR. NEWTON MUREB — AGENDAMENTO E CANCELAMENTO
   Integração com webhooks n8n
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  // ENDPOINTS
  const WEBHOOK_DISPONIBILIDADE =
    'https://n8n.srv1352561.hstgr.cloud/webhook/agendadisp';
  const WEBHOOK_AGENDAMENTO =
    'https://n8n.srv1352561.hstgr.cloud/webhook/agendaclinica';
  // Mantido o endpoint de cancelamento que já era utilizado.
  const WEBHOOK_CANCELAMENTO =
    'https://n8n.srv1352561.hstgr.cloud/webhook/cancelar';

  // Regras de calendário mantidas da versão anterior.
  // Dias bloqueados: domingo (0), quarta-feira (3) e sábado (6).
  const FERIADOS = [
    '2026-01-01', '2026-04-21', '2026-04-23', '2026-04-24',
    '2026-05-01', '2026-06-04', '2026-06-05', '2026-09-07',
    '2026-10-12', '2026-11-02', '2026-11-13', '2026-11-20',
    '2026-12-25'
  ];
  const DIAS_BLOQUEADOS = [0, 3, 6];

  const formAgenda = document.getElementById('formAgenda');
  const successAgenda = document.getElementById('successAgenda');
  const selectHor = document.getElementById('horarios');
  const inputData = document.getElementById('data');
  const btnAgendar = document.getElementById('btnAgendar');
  const camposObrigatorios = [...formAgenda.querySelectorAll('[required]')];

  const formCancel = document.getElementById('formCancel');
  const protocoloEl = document.getElementById('protocolo');
  const feedbackEl = document.getElementById('feedbackCancel');
  const btnCancelar = document.getElementById('btnCancelar');

  const toISO = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const isDiaUtil = (date) =>
    !DIAS_BLOQUEADOS.includes(date.getDay()) &&
    !FERIADOS.includes(toISO(date));

  function proximoDiaUtil(base = new Date()) {
    const date = new Date(base);
    do {
      date.setDate(date.getDate() + 1);
    } while (!isDiaUtil(date));
    return date;
  }

  function addDiasUteis(base, quantidade) {
    const date = new Date(base);
    let contagem = 0;
    while (contagem < quantidade) {
      date.setDate(date.getDate() + 1);
      if (isDiaUtil(date)) contagem++;
    }
    return date;
  }

  // NAVEGAÇÃO ENTRE ABAS
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.view-panel');

  function switchTab(target) {
    tabs.forEach(tab => {
      const active = tab.dataset.tab === target;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    panels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `panel${target === 'agenda' ? 'Agenda' : 'Cancel'}`);
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabs.forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

  // VALIDAÇÃO DO FORMULÁRIO
  function validarFormularioAgenda() {
    const preenchidos = camposObrigatorios.every(campo => {
      if (campo.type === 'checkbox' || campo.type === 'radio') return campo.checked;
      return String(campo.value || '').trim() !== '';
    });
    btnAgendar.disabled = !(preenchidos && selectHor.value);
  }

  camposObrigatorios.forEach(campo => {
    campo.addEventListener('input', validarFormularioAgenda);
    campo.addEventListener('change', validarFormularioAgenda);
  });
  selectHor.addEventListener('change', validarFormularioAgenda);

  // CALENDÁRIO
  function configurarCalendario() {
    const hoje = new Date();
    if (hoje.getHours() >= 16) hoje.setDate(hoje.getDate() + 1);
    hoje.setHours(0, 0, 0, 0);

    const primeiraData = proximoDiaUtil(hoje);
    const ultimaData = addDiasUteis(hoje, 5);

    inputData.min = toISO(primeiraData);
    inputData.max = toISO(ultimaData);
    inputData.value = toISO(primeiraData);
  }

  // DISPONIBILIDADE
  async function carregarHorarios() {
    const dataSelecionada = inputData.value;
    if (!dataSelecionada) return;

    selectHor.innerHTML = '<option value="">Carregando horários...</option>';
    selectHor.disabled = true;
    btnAgendar.disabled = true;

    try {
      const response = await fetch(
        `${WEBHOOK_DISPONIBILIDADE}?data=${encodeURIComponent(dataSelecionada)}`,
        { method: 'GET', headers: { 'Accept': 'application/json' } }
      );

      if (!response.ok) {
        throw new Error(`Falha ao consultar disponibilidade (${response.status}).`);
      }

      const retorno = await response.json();
      const slots = Array.isArray(retorno) ? retorno : (retorno.slots || []);

      selectHor.innerHTML = '<option value="">Selecione o horário</option>';

      if (!Array.isArray(slots) || slots.length === 0) {
        selectHor.innerHTML = '<option value="">Sem horários disponíveis</option>';
        return;
      }

      slots.forEach(slot => {
        // Compatível com o formato já utilizado: { inicio, hora }.
        const inicio = slot.inicio ?? slot.start ?? slot.value;
        const hora = slot.hora ?? slot.label ?? inicio;
        if (!inicio) return;

        const option = document.createElement('option');
        option.value = inicio;
        option.textContent = hora || inicio;
        selectHor.appendChild(option);
      });

      if (selectHor.options.length === 1) {
        selectHor.innerHTML = '<option value="">Sem horários disponíveis</option>';
      }
    } catch (error) {
      console.error('Erro ao carregar disponibilidade:', error);
      selectHor.innerHTML = '<option value="">Não foi possível carregar. Tente novamente.</option>';
    } finally {
      selectHor.disabled = false;
      validarFormularioAgenda();
    }
  }

  inputData.addEventListener('change', () => {
    if (!inputData.value) return;

    const selecionada = new Date(`${inputData.value}T00:00:00`);
    if (!isDiaUtil(selecionada)) {
      alert('Não há atendimento nessa data. Selecione outro dia disponível.');
      inputData.value = toISO(proximoDiaUtil(selecionada));
    }
    carregarHorarios();
    validarFormularioAgenda();
  });

  // ENVIO DO AGENDAMENTO
  formAgenda.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!formAgenda.reportValidity()) return;
    if (!selectHor.value) {
      alert('Selecione um horário disponível.');
      return;
    }

    const dados = Object.fromEntries(new FormData(formAgenda).entries());
    // Mantém o campo "inicio" usado pelo workflow anterior.
    dados.inicio = selectHor.value;

    btnAgendar.disabled = true;
    btnAgendar.textContent = 'Enviando solicitação...';

    try {
      const response = await fetch(WEBHOOK_AGENDAMENTO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(dados)
      });

      if (!response.ok) {
        throw new Error(`Falha ao enviar agendamento (${response.status}).`);
      }

      formAgenda.classList.add('hidden');
      successAgenda.classList.remove('hidden');
    } catch (error) {
      console.error('Erro ao agendar:', error);
      alert('Não foi possível enviar seu agendamento. Verifique sua conexão e tente novamente.');
      btnAgendar.innerHTML = '<span aria-hidden="true">✓</span> Confirmar agendamento';
      validarFormularioAgenda();
    }
  });

  // REINICIAR FORMULÁRIO
  window.resetAgenda = function () {
    formAgenda.reset();
    formAgenda.classList.remove('hidden');
    successAgenda.classList.add('hidden');
    btnAgendar.innerHTML = '<span aria-hidden="true">✓</span> Confirmar agendamento';
    configurarCalendario();
    carregarHorarios();
    validarFormularioAgenda();
  };

  // CANCELAMENTO
  protocoloEl.addEventListener('input', () => {
    protocoloEl.value = protocoloEl.value.replace(/\D/g, '');
  });

  formCancel.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!formCancel.reportValidity()) return;

    const protocolo = protocoloEl.value.trim();
    if (!protocolo) {
      alert('Informe o número do protocolo.');
      return;
    }

    btnCancelar.disabled = true;
    btnCancelar.innerHTML = '<span aria-hidden="true">…</span> Processando...';
    feedbackEl.className = 'feedback-cancel hidden';
    feedbackEl.textContent = '';

    try {
      const response = await fetch(WEBHOOK_CANCELAMENTO, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ protocolo })
      });

      if (!response.ok) {
        throw new Error(`Falha ao cancelar (${response.status}).`);
      }

      feedbackEl.textContent = 'Solicitação de cancelamento processada com sucesso.';
      feedbackEl.className = 'feedback-cancel success';
      formCancel.reset();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      feedbackEl.textContent = 'Não foi possível cancelar. Confira o protocolo ou tente novamente.';
      feedbackEl.className = 'feedback-cancel error';
    } finally {
      btnCancelar.disabled = false;
      btnCancelar.innerHTML = '<span aria-hidden="true">×</span> Solicitar cancelamento';
    }
  });

  // INICIALIZAÇÃO
  configurarCalendario();
  carregarHorarios();
  validarFormularioAgenda();
});
