const WEBHOOK_DISPONIBILIDADE = 'https://n8n.srv1352561.hstgr.cloud/webhook/agendadisp';
const WEBHOOK_AGENDAMENTO = 'https://n8n.srv1352561.hstgr.cloud/webhook/agendaclinica';

const inputData = document.getElementById('data');
const selectHorario = document.getElementById('horario');
const inputCpf = document.getElementById('cpf');
const inputCelular = document.getElementById('celular');
const form = document.getElementById('formAgendamento');
const telaSucesso = document.getElementById('telaSucesso');
const statusMensagem = document.getElementById('statusMensagem');
const btnSubmit = document.getElementById('btnSubmit');
const btnCancelar = document.getElementById('btnCancelar');
const btnNovoAgendamento = document.getElementById('btnNovoAgendamento');

// Elementos do resumo na tela de sucesso
const resumoNome = document.getElementById('resumoNome');
const resumoUnidade = document.getElementById('resumoUnidade');
const resumoEspecialista = document.getElementById('resumoEspecialista');
const resumoProcedimento = document.getElementById('resumoProcedimento');
const resumoDataHora = document.getElementById('resumoDataHora');

// Formata objeto Date para 'YYYY-MM-DD' respeitando o fuso horário local
function formatarDataISO(dataObj) {
  const ano = dataObj.getFullYear();
  const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
  const dia = String(dataObj.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

// Formata 'YYYY-MM-DD' para 'DD/MM/YYYY'
function formatarDataBR(dataISO) {
  if (!dataISO) return '';
  const [ano, mes, dia] = dataISO.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Calcula o primeiro dia útil seguinte (Segunda a Sexta)
function obterProximoDiaUtil() {
  const data = new Date();
  data.setDate(data.getDate() + 1); // Dia seguinte

  // 0 = Domingo, 6 = Sábado
  while (data.getDay() === 0 || data.getDay() === 6) {
    data.setDate(data.getDate() + 1);
  }

  return formatarDataISO(data);
}

// Consulta o Webhook do n8n e popula o select de horários disponíveis
async function carregarHorariosDisponiveis(dataSelecionada) {
  ocultarErro();

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
      option.value = slot.inicio;
      option.textContent = slot.hora;
      option.dataset.hora = slot.hora;
      selectHorario.appendChild(option);
    });

    selectHorario.disabled = false;
  } catch (error) {
    console.error(error);
    selectHorario.innerHTML = '<option value="">Erro ao carregar horários</option>';
    selectHorario.disabled = true;
  }
}

// Define a data padrão como o primeiro dia útil seguinte e já carrega os horários
function inicializarDataPadrao() {
  const hojeISO = formatarDataISO(new Date());
  const proximoDiaUtilISO = obterProximoDiaUtil();

  inputData.setAttribute('min', hojeISO);
  inputData.value = proximoDiaUtilISO;

  carregarHorariosDisponiveis(proximoDiaUtilISO);
}

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

// Recarrega horários sempre que o usuário alterar a data manualmente
inputData.addEventListener('change', () => {
  carregarHorariosDisponiveis(inputData.value);
});

// Enviar agendamento e exibir tela de encerramento
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  ocultarErro();

  const cpfLimpo = inputCpf.value.replace(/\D/g, '');
  const celularLimpo = inputCelular.value.replace(/\D/g, '');
  const celularFormatado = celularLimpo.startsWith('55') ? `+${celularLimpo}` : `+55${celularLimpo}`;

  const inicioISO = selectHorario.value;
  const horaTexto = selectHorario.options[selectHorario.selectedIndex]?.dataset?.hora ||
                    selectHorario.options[selectHorario.selectedIndex]?.textContent || '';

  const unidadeValor = document.getElementById('unidade').value;
  const especialistaValor = document.getElementById('especialista').value;
  const procedimentoValor = document.getElementById('tipo_atendimento').value;
  const nomeValor = document.getElementById('nome').value.trim();
  const dataValor = inputData.value;

  const payload = {
    unidade: unidadeValor,
    especialista: especialistaValor,
    tipo_atendimento: procedimentoValor,
    nome: nomeValor,
    cpf: cpfLimpo,
    celular: celularFormatado,
    email: document.getElementById('email').value.trim(),
    assunto: document.getElementById('assunto').value.trim(),
    data: dataValor,
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

    // Preenche os dados na tela de encerramento
    resumoNome.textContent = nomeValor;
    resumoUnidade.textContent = unidadeValor;
    resumoEspecialista.textContent = especialistaValor;
    resumoProcedimento.textContent = procedimentoValor;
    resumoDataHora.textContent = `${formatarDataBR(dataValor)} às ${horaTexto}`;

    // Esconde o formulário e exibe a tela de encerramento
    form.style.display = 'none';
    telaSucesso.style.display = 'block';
  } catch (error) {
    console.error(error);
    exibirErro('Não foi possível concluir o agendamento. Verifique os dados e tente novamente.');
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Confirmar Agendamento';
  }
});

// Botão "Realizar Novo Agendamento" na tela de encerramento
btnNovoAgendamento.addEventListener('click', () => {
  form.reset();
  telaSucesso.style.display = 'none';
  form.style.display = 'block';
  inicializarDataPadrao();
});

// Botão "Cancelar" limpa os campos e restaura o primeiro dia útil seguinte
btnCancelar.addEventListener('click', () => {
  form.reset();
  inicializarDataPadrao();
});

function exibirErro(texto) {
  statusMensagem.textContent = texto;
  statusMensagem.className = 'status-message error';
  statusMensagem.style.display = 'block';
}

function ocultarErro() {
  statusMensagem.style.display = 'none';
}

// Inicializa a agenda ao abrir a página
document.addEventListener('DOMContentLoaded', inicializarDataPadrao);
