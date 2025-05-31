import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { AlertController, LoadingController } from '@ionic/angular';

// INTERFACE PARA MODELAR A RESPOSTA E CONVERTER PARA UM TIPO PERSONALIZADO MOEDA
interface Moeda{
  codigo: string;
  name: string;
}

// INTERFACE PARA MODELAR A RESPOSTA DA API E CONVERTER PARA UM TIPO PERSONALIZADO TAXACAMBIO
interface TaxaCambio{
  [key:string]:number;
}

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page {

  // Definição de variaveis a serem usadas na conversão
  soma: number=0;
  moedaOrigem: string = 'USD';
  moedaDestino: string = 'BRL';

  // Variaveis utilizadas para a resposta da pesquisa da API
  moedas: Moeda[] = [];
  taxasCambio: TaxaCambio = {};

  //Filtros
  moedasFiltradas: Moeda[] = [];
  moedasParaFiltro: Moeda[] = [];
  termoPesquisaInicial: string = '';
  termoPesquisaFinal: string = '';

  // Estados da tela
  carregando: boolean = false;
  ultimaAtualizacao: string = "";


  constructor(
    private http: HttpClient,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController
  ) {}

  ngOnInit(){
    this.carregarTaxasCambio();
  }

  async carregarTaxasCambio(){
    this.carregando = true;

    try {
      
    } catch (error) {
      console.log("Erro ao carregar as taxas de cambio: ", error);
      await this.showAlert('Erro', 'Não foi possivel atualizar');
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

}
