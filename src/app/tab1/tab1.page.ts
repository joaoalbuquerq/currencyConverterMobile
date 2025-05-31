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
  exibirHistorico: boolean = false;


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

  atualizarTaxas(){
    this.carregarTaxasCambio();
  }

  async carregarMoedas(){
    const caregandoMoedas = await this.loadingCtrl.create({
      message: 'Carregando moedas...'
    });
    await caregandoMoedas.present();

    try {
      const respostaApi: any = await this.http.get(
        `${this.baseUrl}/${this.apiKey}/codes`
      ).toPromise();

      this.moedas = respostaApi.supported_codes.map((item: any[]) => ({
        codigo: item[0],
        nome: item[1]
      }));

      this.filteredFromCurrencies = [...this.moedas];
      this.filteredToCurrencies = [...this.moedas];

      await this.carregarTaxasCambio();

    } catch (error) {
      console.log('Erro ao carregar moedas: ', error);
      await this.showAlert('Erro','Não foi possível carregar as moedas')
    }

    await caregandoMoedas.dismiss();
  }

  async carregarTaxasCambio(){
    this.carregando = true;

    try {

      const respostaApi: any = await this.http.get(
        `${this.baseUrl}/${this.apiKey}/latest/${this.moedaOrigem}`
      ).toPromise();

      this.taxasCambio = respostaApi.conversion_rates;
      this.ultimaAtualizacao = new Date().toLocaleString('pt-BR');
      
    } catch (error) {
      console.log("Erro ao carregar as taxas de cambio: ", error);
      await this.showAlert('Erro', 'Não foi possivel atualizar as taxas de cambio');
    }

    this.carregando = false;
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

  selectFromCurrency(moeda: Moeda) {
    this.moedaOrigem = moeda.codigo;
    this.fromSearchTerm = '';
    this.filteredFromCurrencies = [...this.moedas];
    // Recarrega as taxas com a nova moeda base
    this.carregarTaxasCambio();
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

    await this.salvarHistoricoConversoes(this.valor, this.moedaOrigem, this.moedaDestino, this.resultado, taxa)
  }

   async trocarConversao() {
    const temp = this.moedaDestino;
    this.moedaDestino = this.moedaOrigem;
    this.moedaOrigem = temp;
    
    // Recarrega as taxas com a nova moeda base
    await this.carregarTaxasCambio();
    
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
        atulizacao: new Date(item.ultimaAlteracao)
      })): []
    } catch (error) {
      console.error('Erro ao carregar histórico',error);
      this.historico = [];
    }
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

  mostrarHistorico(){
    this.exibirHistorico = !this.exibirHistorico;
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
            this.exibirHistorico = false;
          }
        }
      ]
    });

    await alerta.present();
  }

}
