/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import MessageBox from "sap/m/MessageBox";
import BaseController from "./BaseController";
import MessageToast from 'sap/m/MessageToast';
import FileUploader from "sap/ui/unified/FileUploader";
import JSONModel from "sap/ui/model/json/JSONModel";
import ResourceBundle from "sap/base/i18n/ResourceBundle";

type Options = {
    "clientId": string,
    "extraction": {
        "headerFields": [string],
        "lineItemFields": [string]
    },
    "documentType": string    	
}

type Response = {
	"status": string,
	"id": string,
	"processedTime": string
}

type Item = {
		"name": string,
		"category": string,
		"value": any,
		"rawValue": any,
		"type": string,
		"page": number,
		"confidence": float,
		"coordinates": {
			"x": float,
			"y": float,
			"w": float,
			"h": float
		},
		"label": string
	}


/**
 * @namespace miyasuta.ui5die.controller
 */
export default class Main extends BaseController {
	private _jobId: string;

	public onInit(): void {
		const oModel = {}
		this.getView().setModel(new JSONModel(oModel), "invoice")

		const oModel2 = {
			editable: false,
			refreshEnabled: false,
			uploadEnabled: false
		}
		this.getView().setModel(new JSONModel(oModel2), "viewModel")
	}

	public async handleUploadPress(): Promise<void> {
		if(this._jobId) {
			MessageBox.confirm((this.getResourceBundle() as ResourceBundle).getText("confirmText"), {
				onClose: async (oAction: string) => {
					if (oAction === "OK") {
						this._resetData()
						await this._uploadImage()
					}
				}
			})			
		} else {
			await this._uploadImage()
		}
	}

	public onFileChange(): void {
		const oFileUploader = this.byId("fileUploader") as FileUploader
		if (oFileUploader.getValue()) {
			(this.getView().getModel("viewModel") as JSONModel).setProperty("/uploadEnabled", true)
		}
	}

	public async onRefresh(): Promise<void> {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		const response = await this._getStatus()
		if (response.status === "DONE") {
			this._setInvoiceData(response.extraction)
			const viewModel = this.getView().getModel("viewModel") as JSONModel
			viewModel.setProperty("/refreshEnabled", false)
			viewModel.setProperty("/editable", true)
		
		} else if (response.status === "PENDING") {
			MessageToast.show((this.getResourceBundle() as ResourceBundle).getText("pendingText"))
		}
	}

	public onSave(): void {
		MessageToast.show((this.getResourceBundle() as ResourceBundle).getText("saveText"))
	}

	private _resetData(): void {
		(this.getView().getModel("invoice") as JSONModel).setData({})
		this._jobId = ""
	}

	private async _uploadImage(): Promise<void> {
		//prepare form data
		const oFileUploader = this.byId("fileUploader") as FileUploader
		const oUploadedFile = oFileUploader.oFileUpload.files[0] as File
		const blob = new Blob([oUploadedFile], { type: oUploadedFile.type })

		const formData = new FormData()
		formData.append("file", blob, oUploadedFile.name)

		const options = (this.getOwnerComponent().getModel("options") as JSONModel).getData() as Options
		formData.append('options', JSON.stringify(options))

		//call die
		const response = await this._postToDie(formData)
		this._jobId = response.id;

		// enable refresh button
		(this.getView().getModel("viewModel") as JSONModel).setProperty("/refreshEnabled", true)		
	}

	private async _postToDie(formData:FormData): Promise<Response> {
		const dieUrl = this._getbaseUrl() + "/document/jobs"
		const response  = await fetch(dieUrl, {
			method: 'POST',
			body: formData
		})
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return response.json()
	}

	private async _getStatus(): Promise<any> {
		const dieUrl = this._getbaseUrl() + "/document/jobs" + "/" + this._jobId
		const response  = await fetch(dieUrl, {
			method: 'GET'
		})
		return response.json()
	}

	private _getbaseUrl(): string {
		const appId = this.getOwnerComponent().getManifestEntry("/sap.app/id")
		const appPath = appId.replaceAll(".", "/")
		const appModulePath = jQuery.sap.getModulePath(appPath) as string
		return appModulePath + "/doc-info-extraction"
	}

	private _setInvoiceData(extractedData: any): void {
		const invoice = {}

		//set header
		const invoiceHeader = (extractedData.headerFields as Item[]).reduce((acc, curr) => {
			acc[curr.name] = curr.value
			return acc
		}, {}) 

		//set items
		const invoiceItems = (extractedData.lineItems as Item[][]).reduce((acc, item) => {			
			const lineItem = item.reduce((acc, curr) => {
				acc[curr.name] = curr.value
				return acc
			} , {})
			acc.push(lineItem)
			return acc
		}, [])

		invoice["header"] = invoiceHeader;
		invoice["items"] = invoiceItems;

		(this.getView().getModel("invoice") as JSONModel).setData(invoice)
	}

}
