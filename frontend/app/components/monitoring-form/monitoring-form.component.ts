import { Component, OnInit, Input, Output, EventEmitter } from "@angular/core";
import { FormGroup, FormBuilder, Validators } from "@angular/forms";
import { MonitoringObject } from "../../class/monitoring-object";
// import { Router } from "@angular/router";
import { ConfigService } from "../../services/config.service";
import { DataUtilsService } from "../../services/data-utils.service";
import { CommonService } from "@geonature_common/service/common.service";
import { DynamicFormService } from "@geonature_common/form/dynamic-form-generator/dynamic-form.service";
import { ActivatedRoute } from "@angular/router";

@Component({
  selector: "pnx-monitoring-form",
  templateUrl: "./monitoring-form.component.html",
  styleUrls: ["./monitoring-form.component.css"],
})
export class MonitoringFormComponent implements OnInit {
  @Input() currentUser;

  @Input() objForm: FormGroup;

  @Input() obj: MonitoringObject;
  @Output() objChanged = new EventEmitter<MonitoringObject>();

  @Input() objectsStatus;
  @Output() objectsStatusChange = new EventEmitter<Object>();

  @Input() bEdit: boolean;
  @Output() bEditChange = new EventEmitter<boolean>();

  @Input() sites: {};

  searchSite = "";

  objFormsDefinition;

  meta: {};


  public bSaveSpinner = false;
  public bSaveAndAddChildrenSpinner = false;
  public bDeleteSpinner = false;
  public bDeleteModal = false;
  public bChainInput = false;
  public bAddChildren = false;
  public chainShow = []


  public queryParams = {};

  constructor(
    private _formBuilder: FormBuilder,
    private _route: ActivatedRoute,
    private _configService: ConfigService,
    private _commonService: CommonService,
    private _dataUtilsService: DataUtilsService,
    private _dynformService: DynamicFormService
  ) {}

  ngOnInit() {
    this._configService
      .init(this.obj.moduleCode)
      .pipe(
      )
      .subscribe(() => {
        // return this._route.queryParamMap;
      // })
      // .subscribe((queryParams) => {
        this.queryParams = this._route.snapshot.queryParams || {};
        this.bChainInput = this._configService.frontendParams()["bChainInput"];
        const schema = this.obj.schema();
        // init objFormsDefinition

        // meta pour les parametres dynamiques
        // ici pour avoir acces aux nomenclatures
        this.meta = {
            nomenclatures: this._dataUtilsService.getDataUtil('nomenclature'),
            dataset: this._dataUtilsService.getDataUtil('dataset'),
            id_role: this.currentUser.id_role,
            bChainInput: this.bChainInput,
            parents: this.obj.parents
        }
        this.objFormsDefinition = this._dynformService
          .formDefinitionsdictToArray(schema, this.meta)
          .filter((formDef) => formDef.type_widget)
          .sort((a, b) => { // medias ?? la fin
            return a.attribut_name === "medias"
              ? +1
              : b.attribut_name === "medias"
              ? -1
              : 0;
          })

        // display_form pour customiser l'ordre dans le formulaire
        // les ??l??ments de display form sont plac?? en haut dans l'ordre du tableau
        // tous les ??l??ments non cach??s restent affich??s
        let displayProperties = [ ...(this.obj.configParam('display_properties') || []) ];
        if (displayProperties && displayProperties.length) {
          displayProperties.reverse();
          this.objFormsDefinition.sort( (a, b) => {
            let indexA = displayProperties.findIndex(e => e == a.attribut_name);
            let indexB = displayProperties.findIndex(e => e == b.attribut_name);
            return indexB - indexA;
          })
        }           

        // champs patch pour simuler un changement de valeur et d??clencher le recalcul des propri??t??
        // par exemple quand bChainInput change
        this.objForm.addControl("patch_update", this._formBuilder.control(0))


        // set geometry
        if (this.obj.config["geometry_type"]) {
          this.objForm.addControl(
            "geometry",
            this._formBuilder.control("", Validators.required)
          );
        }

        // pour donner la valeur de idParent
        this.setQueryParams();

        this.initForm();
      });
  }

  /** pour r??utiliser des param??tres d??j?? saisis */
  keepDefinitions() {
    return this.objFormsDefinition.filter((def) =>
      this.obj.configParam("keep").includes(def.attribut_name)
    );
  }

  setQueryParams() {
    // par le biais des parametre query de route on donne l'id du ou des parents
    // permet d'avoir un 'tree' ou un objet est sur plusieurs branches
    // on attend des ids d'o?? test avec parseInt
    for (const key of Object.keys(this.queryParams)) {
      const strToInt = parseInt(this.queryParams[key]);
      if (strToInt != NaN) {
        this.obj.properties[key] = strToInt;
      }
    }
  }

  /** initialise le formulaire quand le formulaire est pr??t ou l'object est pr??t */
  initForm() {
    if (!(this.objForm && this.obj.bIsInitialized)) {
      return;
    }

    // pour donner la valeur de l'objet au formulaire
    this.obj.formValues().subscribe((formValue) => {
      this.objForm.patchValue(formValue);
      this.setDefaultFormValue();
    });
  }

  keepNames() {
    return this.obj.configParam('keep')
  }

  resetObjForm() {
    // quand on enchaine les relev??s
    const chainShow = this.obj.configParam('chain_show');
    if (chainShow) {
      this.chainShow.push(chainShow.map(key => this.obj.resolvedProperties[key]))
      this.chainShow.push(this.obj.resolvedProperties)
    }

    // les valeur que l'on garde d'une saisie ?? l'autre
    const keep = {};
    for (const key of this.keepNames()) {
      keep[key] = this.obj.properties[key];
    }

    // nouvel object
    this.obj = new MonitoringObject(
      this.obj.moduleCode,
      this.obj.objectType,
      null,
      this.obj.monitoringObjectService()
    );

    this.obj.properties[this.obj.configParam("id_field_Name")] = null;


    // pq get ?????
    // this.obj.get(0).subscribe(() => {
      this.obj.bIsInitialized = true;
      for (const key of this.keepNames()) {
        this.obj.properties[key] = keep[key];
      }
      this.initForm();
    // });
  }

  /** Pour donner des valeurs par defaut si la valeur n'est pas d??finie
   * id_digitiser => current_user.id_role
   * id_inventor => current_user.id_role
   * date => today
   */
  setDefaultFormValue() {
    const value = this.objForm.value;
    const date = new Date();
    const defaultValue = {
      id_digitiser: value["id_digitiser"] || this.currentUser.id_role,
      id_inventor: value["id_inventor"] || this.currentUser.id_role,
      first_use_date: value['first_use_date'] || {
          year: date.getUTCFullYear(),
          month: date.getUTCMonth() + 1,
          day: date.getUTCDate(),
        }
      }
    this.objForm.patchValue(defaultValue);
  }

  /**
   * TODO faire des fonctions dans monitoring objet (ou moniotring objet service pour naviguer
   */

  /**
   * Valider et renseigner les enfants
   */
  navigateToAddChildren() {
    this.bEditChange.emit(false);
    this.obj.navigateToAddChildren();
  }

  /**
   * Valider et aller ?? la page de l'objet
   */
  navigateToDetail() {
    this.bEditChange.emit(false); // patch bug navigation
    this.obj.navigateToDetail()
  }

  /**
   * Valider et aller ?? la page de l'objet
   */
  navigateToParent() {
    this.bEditChange.emit(false); // patch bug navigation
    this.obj.navigateToParent();
  }
 
  msgToaster(action) {
    return `${action} ${this.obj.labelDu()} ${this.obj.description()} effectu??e`.trim()
  }

  /** TODO am??liorer site etc.. */
  onSubmit() {
    const action = this.obj.id
      ? this.obj.patch(this.objForm.value)
      : this.obj.post(this.objForm.value);
    const actionLabel = this.obj.id ? "Modification" : "Cr??ation";
    action.subscribe((objData) => {
      this._commonService.regularToaster(
        "success",
        this.msgToaster(actionLabel)
        );
      this.bSaveSpinner = this.bSaveAndAddChildrenSpinner = false;
      this.objChanged.emit(this.obj);

      /** si c'est un module : reset de la config */
      if (this.obj.objectType === "module") {
        this._configService.loadConfig(this.obj.moduleCode).subscribe();
      }

      if (this.bChainInput) {
        this.resetObjForm();
      } else if (this.bAddChildren) {
        this.navigateToAddChildren();
      } else {
        this.navigateToDetail();
      }
    });
  }

  onCancelEdit() {
    if (this.obj.id) {
      this.bEditChange.emit(false);
    } else {
      this.navigateToParent();
    }
  }

  onDelete() {
    this.bDeleteSpinner = true;
    this._commonService.regularToaster("info", this.msgToaster('Suppression'));

    this.obj.delete().subscribe((objData) => {
      this.bDeleteSpinner = this.bDeleteModal = false;
      this.obj.deleted = true;
      this.objChanged.emit(this.obj);

      setTimeout(() => {
        this.navigateToParent();
      }, 100)
    });
  }

  onObjFormValueChange(event) {
    const change = this.obj.change();
    if (!change) {
      return;
    }
    setTimeout(() => {
      change({objForm:this.objForm, meta: this.meta})
    }, 100);
  }

  procesPatchUpdateForm() {
    this.objForm.patchValue({'patch_update': this.objForm.value.patch_update + 1})
  }

  /** bChainInput gard?? dans config service */
  bChainInputChanged() {
    for (const formDef of this.objFormsDefinition) {
      formDef.meta.bChainInput = this.bChainInput
    }
    this._configService.setFrontendParams("bChainInput", this.bChainInput);
    // patch pour recalculers
    this.procesPatchUpdateForm();
  }
}
