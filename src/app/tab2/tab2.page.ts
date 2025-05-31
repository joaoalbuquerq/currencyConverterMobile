import { Component } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

interface HistoricoConversoes {
  id: string;
  valorOriginal: number;
  moedaOrigem: string;
  moedaDestino: string;
  valorConvertido: number;
  taxa: number;
  ultimaAlteracao: Date;
}

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page {

  historico: HistoricoConversoes[] = [];
  historicoFiltrado: HistoricoConversoes[] = [];
  carregando: boolean = false;
  termoPesquisa: string = '';
  filtroMoeda: string = '';
  ordenacao: 'data' | 'valor' | 'moeda' = 'data';
  ordemCrescente: boolean = false;

  // Estatísticas do histórico
  totalConversoes: number = 0;
  valorTotalConvertido: number = 0;
  moedaMaisUsada: string = '';
  conversaoMaiorValor: HistoricoConversoes | null = null;

  constructor(
    private storage: Storage,
    private alertCtrl: AlertController
  ) {
    this.iniciarStorage();
  }

  async iniciarStorage() {
    await this.storage.create();
  }

  ionViewWillEnter() {
    // Carrega o histórico sempre que a tab for acessada
    this.carregarHistorico();
  }

  async carregarHistorico() {
    this.carregando = true;
    
    try {
      const historicoExistente = await this.storage.get('historico_conversao');
      this.historico = historicoExistente ? historicoExistente.map((item: any) => ({
        ...item,
        ultimaAlteracao: new Date(item.ultimaAlteracao)
      })) : [];
      
      this.historicoFiltrado = [...this.historico];
      this.calcularEstatisticas();
      this.aplicarOrdenacao();
      
    } catch (error) {
      console.error('Erro ao carregar histórico', error);
      this.historico = [];
      this.historicoFiltrado = [];
    }
    
    this.carregando = false;
  }

  calcularEstatisticas() {
    this.totalConversoes = this.historico.length;
    
    if (this.totalConversoes > 0) {
      // Valor total convertido (soma dos valores originais)
      this.valorTotalConvertido = this.historico.reduce((total, item) => total + item.valorOriginal, 0);
      
      // Moeda mais usada (origem)
      const contadorMoedas: { [key: string]: number } = {};
      this.historico.forEach(item => {
        contadorMoedas[item.moedaOrigem] = (contadorMoedas[item.moedaOrigem] || 0) + 1;
      });
      
      this.moedaMaisUsada = Object.keys(contadorMoedas).reduce((a, b) => 
        contadorMoedas[a] > contadorMoedas[b] ? a : b
      );
      
      // Conversão de maior valor
      this.conversaoMaiorValor = this.historico.reduce((maior, atual) => 
        atual.valorOriginal > maior.valorOriginal ? atual : maior
      );
    } else {
      this.valorTotalConvertido = 0;
      this.moedaMaisUsada = '';
      this.conversaoMaiorValor = null;
    }
  }

  pesquisarHistorico(event: any) {
    this.termoPesquisa = event.target.value.toLowerCase();
    this.filtrarHistorico();
  }

  filtrarPorMoeda(event: any) {
    this.filtroMoeda = event.target.value;
    this.filtrarHistorico();
  }

  filtrarHistorico() {
    this.historicoFiltrado = this.historico.filter(item => {
      const matchPesquisa = !this.termoPesquisa || 
        item.moedaOrigem.toLowerCase().includes(this.termoPesquisa) ||
        item.moedaDestino.toLowerCase().includes(this.termoPesquisa) ||
        item.valorOriginal.toString().includes(this.termoPesquisa);
      
      const matchMoeda = !this.filtroMoeda || 
        item.moedaOrigem === this.filtroMoeda || 
        item.moedaDestino === this.filtroMoeda;
      
      return matchPesquisa && matchMoeda;
    });
    
    this.aplicarOrdenacao();
  }

  alterarOrdenacao(tipo: 'data' | 'valor' | 'moeda') {
    if (this.ordenacao === tipo) {
      this.ordemCrescente = !this.ordemCrescente;
    } else {
      this.ordenacao = tipo;
      this.ordemCrescente = false;
    }
    this.aplicarOrdenacao();
  }

  aplicarOrdenacao() {
    this.historicoFiltrado.sort((a, b) => {
      let comparacao = 0;
      
      switch (this.ordenacao) {
        case 'data':
          comparacao = new Date(b.ultimaAlteracao).getTime() - new Date(a.ultimaAlteracao).getTime();
          break;
        case 'valor':
          comparacao = b.valorOriginal - a.valorOriginal;
          break;
        case 'moeda':
          comparacao = a.moedaOrigem.localeCompare(b.moedaOrigem);
          break;
      }
      
      return this.ordemCrescente ? -comparacao : comparacao;
    });
  }

  async deletarItem(item: HistoricoConversoes) {
    const alerta = await this.alertCtrl.create({
      header: 'Deletar Conversão',
      message: `Deseja deletar a conversão de ${item.valorOriginal} ${item.moedaOrigem} para ${item.moedaDestino}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Deletar',
          role: 'destructive',
          handler: async () => {
            await this.deletarItemHistorico(item);
          }
        }
      ]
    });
    
    await alerta.present();
  }

  async deletarItemHistorico(item: HistoricoConversoes) {
    this.historico = this.historico.filter(h => h.id !== item.id);
    this.historicoFiltrado = this.historicoFiltrado.filter(h => h.id !== item.id);
    
    try {
      await this.storage.set('historico_conversao', this.historico);
      this.calcularEstatisticas();
    } catch (error) {
      console.error('Erro ao deletar item do histórico', error);
    }
  }

  async limparHistorico() {
    const alerta = await this.alertCtrl.create({
      header: 'Limpar Histórico',
      message: 'Tem certeza que deseja limpar todo o histórico de conversões?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Limpar',
          role: 'destructive',
          handler: async () => {
            this.historico = [];
            this.historicoFiltrado = [];
            await this.storage.remove('historico_conversao');
            this.calcularEstatisticas();
          }
        }
      ]
    });
    
    await alerta.present();
  }

  async repetirConversao(item: HistoricoConversoes) {
    // Salva os dados da conversão no storage para a Tab1 usar
    await this.storage.set('conversao_repetir', {
      valor: item.valorOriginal,
      moedaOrigem: item.moedaOrigem,
      moedaDestino: item.moedaDestino
    });
    
    // Mostra alerta confirmando que os dados foram preparados
    const alerta = await this.alertCtrl.create({
      header: 'Conversão Preparada',
      message: `Os dados da conversão foram preparados. Vá para a aba "Converter" para executar a conversão com as taxas atuais.`,
      buttons: ['OK']
    });
    
    await alerta.present();
  }

  formatarData(data: Date): string {
    return new Date(data).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatarMoeda(valor: number, moeda: string): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: moeda === 'BRL' ? 'BRL' : 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(valor);
  }

  obterMoedasUnicas(): string[] {
    const moedas = new Set<string>();
    this.historico.forEach(item => {
      moedas.add(item.moedaOrigem);
      moedas.add(item.moedaDestino);
    });
    return Array.from(moedas).sort();
  }

  async exportarHistorico() {
    if (this.historico.length === 0) {
      const alerta = await this.alertCtrl.create({
        header: 'Histórico Vazio',
        message: 'Não há conversões para exportar.',
        buttons: ['OK']
      });
      await alerta.present();
      return;
    }

    // Prepara os dados para exportação
    const dadosExportacao = this.historico.map(item => ({
      'Data': this.formatarData(item.ultimaAlteracao),
      'Valor Original': item.valorOriginal,
      'Moeda Origem': item.moedaOrigem,
      'Moeda Destino': item.moedaDestino,
      'Valor Convertido': item.valorConvertido.toFixed(6),
      'Taxa': item.taxa.toFixed(6)
    }));

    // Converte para JSON formatado
    const jsonString = JSON.stringify(dadosExportacao, null, 2);
    
    // Cria um blob e faz o download (em um app real, você usaria plugins do Capacitor)
    console.log('Dados para exportação:', jsonString);
    
    const alerta = await this.alertCtrl.create({
      header: 'Exportação',
      message: 'Os dados foram preparados para exportação. Verifique o console do navegador para ver os dados em formato JSON.',
      buttons: ['OK']
    });
    
    await alerta.present();
  }

  // Função para otimizar o desempenho do *ngFor
  trackByFn(index: number, item: HistoricoConversoes): string {
    return item.id;
  }
}