import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';
import { Storage } from '@ionic/storage-angular';

// INTERFACE PARA MODELAR A RESPOSTA E CONVERTER PARA UM TIPO PERSONALIZADO MOEDA
interface Moeda{
  codigo: string;
  nome: string;
}

// INTERFACE PARA MODELAR A RESPOSTA DA API E CONVERTER PARA UM TIPO PERSONALIZADO TAXACAMBIO
interface TaxaCambio{
  [key:string]:number;
}

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
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  // Definição de variaveis a serem usadas na conversão
  valor: number=0;
  moedaOrigem: string = 'USD';
  moedaDestino: string = 'BRL';
  resultado: number = 0;

  // Variaveis utilizadas para a resposta da pesquisa da API
  moedas: Moeda[] = [];
  taxasCambio: TaxaCambio = {};

  // Para pesquisa
  filteredFromCurrencies: Moeda[] = [];
  filteredToCurrencies: Moeda[] = [];
  fromSearchTerm: string = '';
  toSearchTerm: string = '';

  // Estados da tela
  carregando: boolean = false;
  ultimaAtualizacao: string = "";

  historico: HistoricoConversoes[] = [];

  // Dados da API
  private apiKey = "47baa309f75101cea3287a40";
  private baseUrl = "https://v6.exchangerate-api.com/v6/"

  constructor(
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private storage: Storage
  ) {
    this.iniciarStorage();
  }

  async iniciarStorage(){
    await this.storage.create();
    await this.carregarHistorico();
  }

  ngOnInit(){
    this.carregarMoedas();
  }

  // Adicionar este método
  async verificarConversaoPreparada() {
    try {
      const conversaoPreparada = await this.storage.get('conversao_repetir');
      if (conversaoPreparada) {
        this.valor = conversaoPreparada.valor;
        this.moedaOrigem = conversaoPreparada.moedaOrigem;
        this.moedaDestino = conversaoPreparada.moedaDestino;
        
        // Remove os dados após usar
        await this.storage.remove('conversao_repetir');
        
        // Carrega as taxas e calcula automaticamente
        await this.carregarTaxasCambio();
        if (this.valor > 0) {
          await this.calcularConversao();
        }
      }
    } catch (error) {
      console.error('Erro ao verificar conversão preparada:', error);
    }
  }

  atualizarTaxas(){
    this.carregarTaxasCambio();
  }

 async carregarMoedas() {
    const carregandoMoedas = await this.loadingCtrl.create({
      message: 'Carregando moedas...'
    });
    await carregandoMoedas.present();

    try {
      // Tenta carregar da API
      const respostaApi: any = await this.http.get(
        `${this.baseUrl}/${this.apiKey}/codes`
      ).toPromise();

      this.moedas = respostaApi.supported_codes.map((item: any[]) => ({
        codigo: item[0],
        nome: item[1]
      }));

      // SALVA no storage para usar depois se der erro
      await this.storage.set('moedas_salvas', this.moedas);

      this.filteredFromCurrencies = [...this.moedas];
      this.filteredToCurrencies = [...this.moedas];

      await this.carregarTaxasCambio();

    } catch (error) {
      console.log('Erro ao carregar moedas da API, tentando usar dados salvos...', error);
      
      // CARREGA do storage se der erro
      const moedasSalvas = await this.storage.get('moedas_salvas');
      
      if (moedasSalvas && moedasSalvas.length > 0) {
        this.moedas = moedasSalvas;
        this.filteredFromCurrencies = [...this.moedas];
        this.filteredToCurrencies = [...this.moedas];
        
        // Tenta carregar taxas também
        await this.carregarTaxasCambio();
        
        await this.showAlert('Sem Internet', 'Usando dados salvos anteriormente.');
      } else {
        await this.showAlert('Erro', 'Não foi possível carregar as moedas e não há dados salvos.');
      }
    }

    await carregandoMoedas.dismiss();
  }

  async carregarTaxasCambio() {
    this.carregando = true;

    try {
      // Tenta carregar da API
      const respostaApi: any = await this.http.get(
        `${this.baseUrl}/${this.apiKey}/latest/${this.moedaOrigem}`
      ).toPromise();

      this.taxasCambio = respostaApi.conversion_rates;
      this.ultimaAtualizacao = new Date().toLocaleString('pt-BR');
      
      // SALVA no storage para usar depois se der erro
      await this.storage.set('taxas_salvas', {
        taxas: this.taxasCambio,
        moedaBase: this.moedaOrigem,
        dataAtualizacao: this.ultimaAtualizacao
      });
      
    } catch (error) {
      console.log("Erro ao carregar taxas da API, tentando usar dados salvos...", error);
      
      // CARREGA do storage se der erro
      const taxasSalvas = await this.storage.get('taxas_salvas');
      
      if (taxasSalvas && taxasSalvas.taxas) {
        // Se a moeda base é a mesma, usa as taxas salvas
        if (taxasSalvas.moedaBase === this.moedaOrigem) {
          this.taxasCambio = taxasSalvas.taxas;
          this.ultimaAtualizacao = taxasSalvas.dataAtualizacao + ' (salvo)';
        } else {
          // Se mudou a moeda base, tenta pegar taxas salvas de qualquer moeda
          const todasTaxasSalvas = await this.storage.get('todas_taxas_salvas') || {};
          
          if (todasTaxasSalvas[this.moedaOrigem]) {
            this.taxasCambio = todasTaxasSalvas[this.moedaOrigem].taxas;
            this.ultimaAtualizacao = todasTaxasSalvas[this.moedaOrigem].dataAtualizacao + ' (salvo)';
          } else {
            this.taxasCambio = {};
          }
        }
      } else {
        this.taxasCambio = {};
      }
    }

    this.carregando = false;
  }

    async salvarTaxasCompletas() {
    try {
      const todasTaxas = await this.storage.get('todas_taxas_salvas') || {};
      
      todasTaxas[this.moedaOrigem] = {
        taxas: this.taxasCambio,
        dataAtualizacao: this.ultimaAtualizacao,
        moedaBase: this.moedaOrigem
      };
      
      await this.storage.set('todas_taxas_salvas', todasTaxas);
    } catch (error) {
      console.error('Erro ao salvar taxas completas:', error);
    }
  }

  filterFromCurrencies(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.fromSearchTerm = searchTerm;
    
    if (!searchTerm) {
      this.filteredFromCurrencies = [...this.moedas];
      return;
    }
    
    this.filteredFromCurrencies = this.moedas.filter(moeda =>
      moeda.nome.toLowerCase().includes(searchTerm) ||
      moeda.codigo.toLowerCase().includes(searchTerm)
    );
  }

  filterToCurrencies(event: any) {
    const searchTerm = event.target.value.toLowerCase();
    this.toSearchTerm = searchTerm;
    
    if (!searchTerm) {
      this.filteredToCurrencies = [...this.moedas];
      return;
    }
    
    this.filteredToCurrencies = this.moedas.filter(moeda =>
      moeda.nome.toLowerCase().includes(searchTerm) ||
      moeda.codigo.toLowerCase().includes(searchTerm)
    );
  }

 async selectFromCurrency(moeda: Moeda) {
    this.moedaOrigem = moeda.codigo;
    this.fromSearchTerm = '';
    this.filteredFromCurrencies = [...this.moedas];
    
    // Recarrega as taxas com a nova moeda base
    await this.carregarTaxasCambio();
    
    // Salva as taxas para futuro uso offline
    if (Object.keys(this.taxasCambio).length > 0) {
      await this.salvarTaxasCompletas();
    }
  }

  selectToCurrency(moeda: Moeda) {
    this.moedaDestino = moeda.codigo;
    this.toSearchTerm = '';
    this.filteredToCurrencies = [...this.moedas];
  }

  async calcularConversao(){
    if(!this.valor || this.valor <= 0){
      await this.showAlert('Atenção', 'Por favor, informe um valor maior que zero');
      return;
    }

    if(!this.taxasCambio[this.moedaDestino]){
      await this.showAlert('Erro','Taxa de cambio não disponível');
      return;
    }

    const taxa = this.taxasCambio[this.moedaDestino];
    console.log(taxa)
    this.resultado = this.valor * taxa;

    await this.salvarHistoricoConversoes(
      this.valor,
      this.moedaOrigem,
      this.moedaDestino,
      this.resultado,
      taxa);
  }

 async trocarConversao() {
    const temp = this.moedaDestino;
    this.moedaDestino = this.moedaOrigem;
    this.moedaOrigem = temp;
    
    // Recarrega as taxas com a nova moeda base
    await this.carregarTaxasCambio();
    
    // Salva as taxas para futuro uso offline
    if (Object.keys(this.taxasCambio).length > 0) {
      await this.salvarTaxasCompletas();
    }
    
    // Recalcula se já há um valor
    if (this.valor > 0) {
      this.calcularConversao();
    }
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  get obterTaxaCambioAtual():number{
    return this.taxasCambio[this.moedaDestino]?.valueOf() || 0;
  }

async carregarHistorico(){
  try {
    const historicoExistente = await this.storage.get('historico_conversao');
    this.historico = historicoExistente ? historicoExistente.map((item: any) => ({
      ...item,
      ultimaAlteracao: new Date(item.ultimaAlteracao) // CORRIGIDO: era 'atulizacao'
    })): []
  } catch (error) {
    console.error('Erro ao carregar histórico',error);
    this.historico = [];
  }
}

ionViewWillEnter() {
  this.verificarConversaoPreparada();
}

  async salvarHistoricoConversoes(valorOriginal:number, moedaOrigem: string, moedaDestino: string, valorConvertido:number, taxa: number){
    const conversao: HistoricoConversoes = {
      id: Date.now().toString(),
      valorOriginal,
      moedaOrigem,
      moedaDestino,
      valorConvertido,
      taxa,
      ultimaAlteracao: new Date()
    };

    this.historico.unshift(conversao);

    if(this.historico.length > 50){
      this.historico = this.historico.slice(0,50);
    }

    try{
      await this.storage.set('historico_conversao', this.historico);
    }catch(error){
      console.error('Erro ao salvar histórico', error)
    }
  }


  async limparHistorico(){
    const alerta = await this.alertCtrl.create({
      header: 'Limpar Histórico',
      message: 'Tem certeza que deseja limpar todo o histórico de conversões ? ',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Limpar',
          role: 'destuctive',
          handler: async() => {
            this.historico = [];
            await this.storage.remove('historico_conversao');
          }
        }
      ]
    });

    await alerta.present();
  }

  async deletarItemHistorico(item: HistoricoConversoes){
    this.historico = this.historico.filter(h => h.id !== item.id);
    try{
      await this.storage.set('historico_conversao',this.historico)
    }catch(error){
      console.error('Erro ao deletar item do histórico', error)
    }
  }

  async repetirConversao(item: HistoricoConversoes) {
    // Salva os dados no storage
    await this.storage.set('conversao_repetir', {
      valor: item.valorOriginal,
      moedaOrigem: item.moedaOrigem,
      moedaDestino: item.moedaDestino
    });
    
    // Recarrega os dados
    await this.verificarConversaoPreparada();
  }

  async limparCache() {
    const alerta = await this.alertCtrl.create({
      header: 'Limpar Cache',
      message: 'Deseja limpar os dados salvos para teste offline?',
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Limpar',
          handler: async () => {
            await this.storage.remove('moedas_salvas');
            await this.storage.remove('taxas_salvas');
            await this.storage.remove('todas_taxas_salvas');
            
            const confirmacao = await this.alertCtrl.create({
              header: 'Cache Limpo',
              message: 'Dados salvos foram removidos.',
              buttons: ['OK']
            });
            await confirmacao.present();
          }
        }
      ]
    });
    
    await alerta.present();
  }

}
