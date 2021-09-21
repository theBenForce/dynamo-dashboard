import * as cdk from "@aws-cdk/core";
import * as dynamo from "@aws-cdk/aws-dynamodb";
import * as cw from "@aws-cdk/aws-cloudwatch";

interface CreateTableWidgetParams {
  tableName: string;
  title: string;
  region: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Widget {
  width: number;
  height: number;
  x: number;
  y: number;

  [key: string]: any;
}

const createTableWidget = (params: CreateTableWidgetParams): Widget => ({
  height: params.height,
  width: params.width,
  y: params.y,
  x: params.x,
  type: "metric",
  properties: {
    metrics: [
      [
        "AWS/DynamoDB",
        "ConsumedReadCapacityUnits",
        "TableName",
        params.tableName,
        { label: "Read (max)" },
      ],
      [".", "ConsumedWriteCapacityUnits", ".", ".", { label: "Write (max)" }],
    ],
    view: "timeSeries",
    stacked: false,
    region: params.region,
    title: params.title,
    stat: "Maximum",
    period: 300,
    liveData: true,
  },
});

interface DynamoDashboardProps {
  columnCount: number;
  widgetHeight: number;
  title: string;
}

const DASHBOARD_WIDTH = 24.0;

export class DynamoDashboard extends cdk.Construct implements cdk.IAspect {
  private dashboard: cw.CfnDashboard;
  widgets: Array<Widget> = [];
  widgetWidth: number;

  constructor(
    scope: cdk.Construct,
    id: string,
    private props: DynamoDashboardProps
  ) {
    super(scope, id);

    cdk.Aspects.of(scope).add(this);

    this.widgetWidth = DASHBOARD_WIDTH / props.columnCount;

    this.dashboard = new cw.CfnDashboard(this, `Dashboard`, {
      dashboardBody: "",
      dashboardName: props.title,
    });
  }

  visit(node: cdk.IConstruct): void {
    if (node instanceof dynamo.CfnTable) {
      let x = 0;
      let y = 0;

      if (this.widgets.length > 0) {
        const lastWidget = this.widgets[this.widgets.length - 1];
        x = lastWidget.x + lastWidget.width;
        y = lastWidget.y;

        if (x >= DASHBOARD_WIDTH - 1) {
          x = 0;
          y += this.props.widgetHeight + 1;
        }
      }

      this.widgets.push(
        createTableWidget({
          x,
          y,
          width: this.widgetWidth,
          height: this.props.widgetHeight,
          region: node.stack.region,
          tableName: node.ref,
          title: node.logicalId,
        })
      );

      this.dashboard.dashboardBody = JSON.stringify({ widgets: this.widgets });
    }
  }
}
